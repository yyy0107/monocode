# Latest-message jump control

Hide the jump-to-latest button when the transcript's actual content end is
visible above the composer, even after the reader stops automatic following.
Exclude padding and the latest turn's minimum-height blank space. Show the
button again when the end leaves the readable viewport or goes under floating
controls. Respect header and composer insets, content growth and resizing.

On mobile, render the button above message images and controls. Tapping it
scrolls to the latest message, retains composer focus, and consumes pointer,
mouse and click events so underlying content does not activate.

Preserve scroll-follow intent, jump animation, prompt motion and unrelated local
work. No provider or persistence changes.
