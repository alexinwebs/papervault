/**
 * Fired on window by the pin button after a pin is saved; detail is the
 * signed-in user's updated nav list ({ slug, name, shortName }[]). The
 * navigation listens so "My Colleges" updates without a page refresh.
 */
export const PINS_CHANGED_EVENT = "papervault:pins-changed";
