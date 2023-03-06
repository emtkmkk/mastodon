# frozen_string_literal: true

class UnreactionService < BaseService
  include Payloadable

  def call(account, status)
    reaction = Reaction.find_by!(account: account, status: status)
    reaction.destroy!
    create_notification(account, reaction)
    reaction
  end

  private

  def create_notification(current_account, reaction)
    status = reaction.status
    ActivityPub::ReactionsDistributionWorker.perform_async(build_json(reaction), current_account.id, status.account.shared_inbox_url)
  end

  def build_json(reaction)
    Oj.dump(serialize_payload(reaction, ActivityPub::UndoEmojiReactSerializer))
  end
end
