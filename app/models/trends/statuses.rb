# frozen_string_literal: true

class Trends::Statuses < Trends::Base
  PREFIX = 'trending_statuses'

  self.default_options = {
    threshold: 1,
    review_threshold: 4,
    score_halflife: 4.hours.freeze,
    decay_threshold: 0.2,
  }

  class Query < Trends::Query
    def filtered_for!(account)
      @account = account
      self
    end

    def filtered_for(account)
      clone.filtered_for!(account)
    end

    def to_arel
      scope = Status.joins(:trend).reorder(score: :desc)
      scope = scope.reorder(language_order_clause.desc, score: :desc) if preferred_languages.present?
      scope = scope.merge(StatusTrend.allowed) if @allowed
      scope = scope.not_excluded_by_account(@account).not_domain_blocked_by_account(@account) if @account.present?
      scope = scope.offset(@offset) if @offset.present?
      scope = scope.limit(@limit) if @limit.present?
      scope
    end

    private

    def language_order_clause
      Arel::Nodes::Case.new.when(StatusTrend.arel_table[:language].in(preferred_languages)).then(1).else(0)
    end

    def preferred_languages
      if @account&.chosen_languages.present?
        @account.chosen_languages
      else
        @locale
      end
    end
  end

  def register(status, at_time = Time.now.utc)
    add(status.proper, status.account_id, at_time) if eligible?(status.proper)
  end

  def add(status, _account_id, at_time = Time.now.utc)
    record_used_id(status.id, at_time)
  end

  def query
    Query.new(key_prefix, klass)
  end

  def refresh(at_time = Time.now.utc)
    statuses = Status.where(id: (recently_used_ids(at_time) + StatusTrend.pluck(:status_id)).uniq).includes(:status_stat, :account)
    calculate_scores(statuses, at_time)
  end

  def request_review
    StatusTrend.pluck('distinct language').flat_map do |language|
      score_at_threshold = StatusTrend.where(language: language, allowed: true).order(rank: :desc).where('rank <= ?', options[:review_threshold]).first&.score || 0
      status_trends      = StatusTrend.where(language: language, allowed: false).joins(:status).includes(status: :account)

      status_trends.filter_map do |trend|
        status = trend.status

        if trend.score > score_at_threshold && !status.trendable? && status.requires_review_notification?
          status.account.touch(:requested_review_at)
          status
        end
      end
    end
  end

  protected

  def key_prefix
    PREFIX
  end

  def klass
    Status
  end

  private

  def eligible?(status)
    status.public_visibility? && status.account.discoverable? && !status.account.silenced? && status.spoiler_text.blank? && !status.sensitive? && !status.reply?
  end

  def calculate_scores(statuses, at_time)
    items = statuses.map do |status|
      expected  = 1.0
      observed  = (status.replies_count + status.reblogs_count + status.favourites_count + status.reactions_count).to_f

      thresholdValue = begin
        if status.local?
          1.0
        else
          4.0
        end
      end

      scoreRaw = begin
        if expected > observed || observed < thresholdValue
          0
        else
          ((observed - expected)**2) / expected
        end
      end

      score = begin
        if status.local?
          scoreRaw * 1.0
        else
          scoreRaw * 0.7
        end
      end

      decaying_score = begin
        if score.zero? || !eligible?(status)
          0
        else
          score * (0.5**((at_time.to_f - status.created_at.to_f) / options[:score_halflife].to_f))
        end
      end

      [decaying_score, status]
    end

    to_insert = items.filter { |(score, _)| score >= options[:decay_threshold] }
    to_delete = items.filter { |(score, _)| score < options[:decay_threshold] }

    StatusTrend.transaction do
      StatusTrend.upsert_all(to_insert.map { |(score, status)| { status_id: status.id, account_id: status.account_id, score: score, language: status.language, allowed: status.trendable? || false } }, unique_by: :status_id) if to_insert.any?
      StatusTrend.where(status_id: to_delete.map { |(_, status)| status.id }).delete_all if to_delete.any?
      StatusTrend.connection.exec_update('UPDATE status_trends SET rank = t0.calculated_rank FROM (SELECT id, row_number() OVER w AS calculated_rank FROM status_trends WINDOW w AS (PARTITION BY language ORDER BY score DESC)) t0 WHERE status_trends.id = t0.id')
    end
  end
end
