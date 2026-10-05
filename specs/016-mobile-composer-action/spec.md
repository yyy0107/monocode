# Mobile composer send action

When a session is running, the mobile composer's primary button shows Send
whenever the draft has non-whitespace text or an attachment. Sending uses the
existing Host submission and queue behavior. With no pending content, the
primary button shows Stop and cancels the current run.

Sending remains disabled whenever `canSend` is false. Temporary submission or
attachment work must not turn a nonempty draft's primary action into Stop.
Preserve the existing queue shortcut, configuration locks, focus behavior,
localized labels and desktop composer.
