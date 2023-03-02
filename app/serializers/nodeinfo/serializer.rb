# frozen_string_literal: true

class NodeInfo::Serializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :version, :software, :protocols, :services, :usage, :open_registrations, :metadata

  def version
    '2.0'
  end

  def software
    { name: 'mastodon', version: Mastodon::Version.to_s + '+' }
  end

  def services
    { outbound: [], inbound: [] }
  end

  def protocols
    %w(activitypub)
  end

  def usage
    {
      users: {
        total: instance_presenter.user_count,
        active_month: instance_presenter.active_user_count(4),
        active_halfyear: instance_presenter.active_user_count(24),
      },

      local_posts: instance_presenter.status_count,
    }
  end

  def open_registrations
    Setting.registrations_mode != 'none' && !Rails.configuration.x.single_user_mode
  end

  def metadata
    {
      nodeName: 'もこもこ港【リアクション受け取れます！】',
      nodeDescription: "Misskeyの皆さんこんにちは。\nこんな場所を見てくれてありがとうございます。\nリアクションを受け取る機能が入っているのでドシドシリアクションしてくれると嬉しいです。\nサーバー登録は承認制なのでサーバー内の誰かとよく話す人のみどうぞ。",
      disableGlobalTimeline: false,
      disableLocalTimeline: false,
      disableRegistration: false,
      emailRequiredForSignup: true,
      enableEmail: true,
      enableHcaptcha: false,
      enableRecaptcha: false,
      langs: [],
      maintainer: {
        email: 'mkmk.hbnet@gmail.com',
        name: 'たこ @emtk',
      },
      maxNoteTextLength: 500,
      themeColor: '#f8bcba',
    }
  end

  private

  def instance_presenter
    @instance_presenter ||= InstancePresenter.new
  end
end
