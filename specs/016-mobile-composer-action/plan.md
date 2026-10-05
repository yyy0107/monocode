# Implementation plan

Choose the mobile primary action from running state and the current draft and
attachments, independently of send availability. Reuse the existing submit,
cancel, disabled and loading states. No Host/provider protocol changes.

Update existing composer checks for sending during a run, disabled sending,
clearing back to Stop and configuration locks. The popup navigation assertion
must count only enabled menu rows, matching the existing focus handler.
Run the mobile test suite and mobile production build. Record executed results
and distinguish physical-device/provider scenarios that were not exercised.
