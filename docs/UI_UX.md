# NeuroBaseline — UI/UX

Updated 12 November 2026. Implemented in the existing buildless web app.

## Visual direction

The interface uses cobalt blue, white cards, a very pale blue background, rounded controls, light shadows and compact data visualisations. Original SVG waves and line icons provide visual detail without external image dependencies. The interface has no chatbot avatar or decorative AI badge.

Core colours: primary `#2449e8`, background `#f5f7ff`, text `#222b45`, secondary text `#6c7490`. Clinical status colours remain distinct from the primary colour.

## Participant experience

- Home: one accent card for the next session with a single call to action, a status card with a ring (sessions recorded while the usual level is being established, then the current status), four activity tiles, a results card with a segmented control and two figures (latest session, usual level and range), and the optional parts as tiles. Settings cards carry an icon heading and list their actions as rows.
- Profile: three questions, one at a time, followed by an editable review.
- Before a session: five context questions followed by setup instructions and an explicit start button.
- Optional health profile: 21 individual questions, with back and skip controls. Numeric entries accept decimals and validate the existing bounds. Missing answers remain unknown; incomplete summaries say so explicitly.
- Selecting an answer highlights it immediately and advances after 280 ms. The incoming question fades and moves by 7 px over 320 ms. Reduced-motion preferences disable visual animation.
- Patient copy uses everyday English and Vietnamese. PHQ-2 questions, scoring, thresholds and task protocols are preserved.
- EEG recording measures are behind an expandable details control.
- Mobile navigation provides Home, History and Settings. Task screens remain free of navigation and decorative motion while measuring responses.

## Clinical workspace

The same palette is used with a denser layout. The list retains its existing priority order and adds participant-code search, filters for review/repeat/overdue, counts and an empty-result state. Detail links jump to indicators, trend, trajectories, risk, EEG, contributors, review and session log without interfering with participant hash routing. Clinical terminology and existing review workflows are preserved.

## Verification

- All 61 checks passed with `node tests/<name>.test.js` run from the `app` folder.
- JavaScript syntax checks passed for the changed UI modules.
- A complete shortened cognitive session ran successfully through the existing QA robot; its data used the separate QA key.
- Browser checks covered profile review/edit, all four context questions, numeric error handling and decimal input, all 21 health questions, skipping, partial-profile save, English/Vietnamese switching, navigation, clinician search/filter/empty state and section links, and opening EEG details from a sample recording.
- Participant layout inspected at 390 × 844 without horizontal overflow; clinician layout inspected at 1280 × 900.
- These are implementation and browser checks; no usability study or clinical validation is implied.

Preview images: [mobile home](ui-preview/home-cobalt-mobile.jpg), [mobile question](ui-preview/question-cobalt-mobile.jpg), [clinical workspace](ui-preview/clinician-cobalt-desktop.jpg).

Primary implementation: `app/css/app.css`, `app/css/clinician.css`, `app/js/app.js`, `app/js/clinician.js`, `app/js/i18n-ui.js`, and the expandable result details in `app/js/eeg-ui.js`.
