declare global {
  // Use implementation aspects of `next-intl` to get the types
  // from our specific messages.
  type IntlMessages = Messages;
}

type Messages = typeof import('@/messages/ar.json');
