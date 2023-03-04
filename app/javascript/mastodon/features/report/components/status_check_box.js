import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import StatusContent from 'mastodon/components/status_content';
import Avatar from 'mastodon/components/avatar';
import DisplayName from 'mastodon/components/display_name';
import RelativeTimestamp from 'mastodon/components/relative_timestamp';
import Option from './option';
import MediaAttachments from 'mastodon/components/media_attachments';
import { injectIntl, defineMessages } from 'react-intl';
import Icon from 'mastodon/components/icon';

const messages = defineMessages({
  public_mouseover: { id: 'privacy.public.mouseover', defaultMessage: 'Public' },
  unlisted_mouseover: { id: 'privacy.unlisted.mouseover', defaultMessage: 'Unlisted' },
  private_mouseover: { id: 'privacy.private.mouseover', defaultMessage: 'Followers-only' },
  direct_mouseover: { id: 'privacy.direct.mouseover', defaultMessage: 'Mentioned people only' },
});

export default @injectIntl
class StatusCheckBox extends React.PureComponent {

  static propTypes = {
    id: PropTypes.string.isRequired,
    status: ImmutablePropTypes.map.isRequired,
    checked: PropTypes.bool,
    onToggle: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
  };

  handleStatusesToggle = (value, checked) => {
    const { onToggle } = this.props;
    onToggle(value, checked);
  };

  render () {
    const { status, checked, intl } = this.props;

    if (status.get('reblog')) {
      return null;
    }

    const visibilityIconInfo = {
      'public': { icon: 'globe', text: intl.formatMessage(messages.public_mouseover) },
      'unlisted': { icon: 'home', text: intl.formatMessage(messages.unlisted_mouseover) },
      'private': { icon: 'lock', text: intl.formatMessage(messages.private_mouseover) },
      'direct': { icon: 'envelope', text: intl.formatMessage(messages.direct_mouseover) },
    };

    const visibilityIcon = visibilityIconInfo[status.get('visibility')];

    const labelComponent = (
      <div className='status-check-box__status poll__option__text'>
        <div className='detailed-status__display-name'>
          <div className='detailed-status__display-avatar'>
            <Avatar account={status.get('account')} size={46} />
          </div>

          <div>
            <DisplayName account={status.get('account')} /> · <span className='status__visibility-icon'><Icon id={visibilityIcon.icon} title={visibilityIcon.text} /></span> <RelativeTimestamp timestamp={status.get('created_at')} />
          </div>
        </div>

        <StatusContent status={status} />
        <MediaAttachments status={status} />
      </div>
    );

    return (
      <Option
        name='status_ids'
        value={status.get('id')}
        checked={checked}
        onToggle={this.handleStatusesToggle}
        label={status.get('search_index')}
        labelComponent={labelComponent}
        multiple
      />
    );
  }

}
