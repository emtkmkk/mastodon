import escapeTextContentForBrowser from 'escape-html';
import emojify from '../../features/emoji/emoji';
import { unescapeHTML } from '../../utils/html';
import { expandSpoilers } from '../../initial_state';

const domParser = new DOMParser();

const makeEmojiMap = record => record.emojis.reduce((obj, emoji) => {
  obj[`:${emoji.shortcode}:`] = emoji;
  return obj;
}, {});

const rewrite = txt => {
  let edit_txt = txt.replaceAll('</p><p>', ' ').replaceAll('<br />', ' ')
  const e = document.createElement('div');
  e.innerHTML = edit_txt;
  return e.innerText;
}

const checkOnlyIconStatus = content => {

  const trimContent = rewrite(content).trim();
  

  const reg_left = "^([@#][^\\s　\u200b]+[\\s　\u200b]+)*[\\s　\u200b]*:\\w+:([\\s　\u200b]+:\\w+:){";
  const reg_right = "}[\\s　\u200b]*([@#][^\\s　\u200b]+[\\s　\u200b]*)*$";
  
  const bg0 = 0;
  const bg1 = 2;
  const bg2 = 13;
  const bg3 = 29;
  
  const reg0 = new RegExp( reg_left + bg0 +  "," + bg3 + reg_right , "i");
  const reg1 = new RegExp( reg_left + bg0 + "," + bg1 + reg_right, "i");
  const reg2 = new RegExp( reg_left + bg1 + "," + bg2 + reg_right, "i");
  const reg3 = new RegExp( reg_left + bg2 + "," + bg3 + reg_right, "i");
  
  if (!trimContent.match(reg0)){
    return 0;
  }
  if (trimContent.match(reg1)){
    return 1;
  }
  if (trimContent.match(reg2)){
    return 2;
  }
  if (trimContent.match(reg3)){
    return 3;
  }
  return 0;
};

export function searchTextFromRawStatus (status) {
  const spoilerText   = status.spoiler_text || '';
  const searchContent = ([spoilerText, status.content].concat((status.poll && status.poll.options) ? status.poll.options.map(option => option.title) : [])).concat(status.media_attachments.map(att => att.description)).join('\n\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/p><p>/g, '\n\n');
  return domParser.parseFromString(searchContent, 'text/html').documentElement.textContent;
}

export function normalizeAccount(account) {
  account = { ...account };

  const emojiMap = makeEmojiMap(account);
  const displayName = account.display_name.trim().length === 0 ? account.username : account.display_name;

  account.display_name_html = emojify(escapeTextContentForBrowser(displayName), emojiMap);
  account.note_emojified = emojify(account.note, emojiMap);
  account.note_plain = unescapeHTML(account.note);

  if (account.fields) {
    account.fields = account.fields.map(pair => ({
      ...pair,
      name_emojified: emojify(escapeTextContentForBrowser(pair.name), emojiMap),
      value_emojified: emojify(pair.value, emojiMap),
      value_plain: unescapeHTML(pair.value),
    }));
  }

  if (account.moved) {
    account.moved = account.moved.id;
  }

  return account;
}

export function normalizeFilterResult(result) {
  const normalResult = { ...result };

  normalResult.filter = normalResult.filter.id;

  return normalResult;
}

export function normalizeStatus(status, normalOldStatus) {
  const normalStatus   = { ...status };
  normalStatus.account = status.account.id;

  if (status.reblog && status.reblog.id) {
    normalStatus.reblog = status.reblog.id;
  }

  if (status.poll && status.poll.id) {
    normalStatus.poll = status.poll.id;
  }

  if (status.filtered) {
    normalStatus.filtered = status.filtered.map(normalizeFilterResult);
  }

  // Only calculate these values when status first encountered and
  // when the underlying values change. Otherwise keep the ones
  // already in the reducer
  if (normalOldStatus && normalOldStatus.get('content') === normalStatus.content && normalOldStatus.get('spoiler_text') === normalStatus.spoiler_text) {
    normalStatus.search_index = normalOldStatus.get('search_index');
    normalStatus.contentHtml = normalOldStatus.get('contentHtml');
    normalStatus.spoilerHtml = normalOldStatus.get('spoilerHtml');
    normalStatus.spoiler_text = normalOldStatus.get('spoiler_text');
    normalStatus.hidden = normalOldStatus.get('hidden');
  } else {
    // If the status has a CW but no contents, treat the CW as if it were the
    // status' contents, to avoid having a CW toggle with seemingly no effect.
    if (normalStatus.spoiler_text && !normalStatus.content) {
      normalStatus.content = normalStatus.spoiler_text;
      normalStatus.spoiler_text = '';
    }
    

    const spoilerText   = normalStatus.spoiler_text || '';
    const searchContent = ([spoilerText, status.content].concat((status.poll && status.poll.options) ? status.poll.options.map(option => option.title) : [])).concat(status.media_attachments.map(att => att.description)).join('\n\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/p><p>/g, '\n\n');
    const emojiMap      = makeEmojiMap(normalStatus);
    const toBigIcon     = checkOnlyIconStatus(normalStatus.content);
    
    if(toBigIcon != 0) {
      normalStatus.content = normalStatus.content.replace(/<span class=\"h-card\"><a href=(.*?)>[@#]<span>[^\\s　\u200b]+<\/span><\/a><\/span>([\s　\u200b]+<span class=\"h-card\"><a href=(.*?)>[@#]<span>[^\s　\u200b]+<\/span><\/a><\/span>)*[\t 　\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+/, '$&<br>')
      normalStatus.content = normalStatus.content.replace(/<a href=(.*?)>[@#][^\s　\u200b]+<\/a><span>[\t 　\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]<\/span>([\s　\u200b]+<a href=(.*?)>[@#][^\s　\u200b]+<\/a><\/span>)*[\t 　\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+/, '$&<br>')
      normalStatus.content = normalStatus.content.replace(/[\t 　\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+<a href=(.*?)>[@#]<span>[^\s　\u200b]+<\/span><\/a>([\s　\u200b]+<a href=(.*?)>[@#]<span>[^\s　\u200b]+<\/span><\/a>)*/, '<br>$&')
    }
    
    normalStatus.search_index = domParser.parseFromString(searchContent, 'text/html').documentElement.textContent;
    normalStatus.contentHtml  = emojify(normalStatus.content, emojiMap, toBigIcon);
    normalStatus.spoilerHtml  = emojify(escapeTextContentForBrowser(spoilerText), emojiMap);
    normalStatus.hidden       = expandSpoilers ? false : spoilerText.length > 0 || normalStatus.sensitive;
  }

  return normalStatus;
}

export function normalizePoll(poll) {
  const normalPoll = { ...poll };
  const emojiMap = makeEmojiMap(normalPoll);

  normalPoll.options = poll.options.map((option, index) => ({
    ...option,
    voted: poll.own_votes && poll.own_votes.includes(index),
    title_emojified: emojify(escapeTextContentForBrowser(option.title), emojiMap),
  }));

  return normalPoll;
}

export function normalizeAnnouncement(announcement) {
  const normalAnnouncement = { ...announcement };
  const emojiMap = makeEmojiMap(normalAnnouncement);

  normalAnnouncement.contentHtml = emojify(normalAnnouncement.content, emojiMap);

  return normalAnnouncement;
}
