Items:

- [x] Improve dashboard UI usking skill
- [x] Time tracking dashboard - is it actually working correctly with graphs? All I see is one
- [x] What does days focused mean and how is it calculated?
- [x] Clean up commits
- [x] Clean up vibe coded slop
- [x] Clean up comments
- [] Create a new name
- [] Open source it
- [] Modify Focus Duration
- [x] Introduce "points" system
- [x] Introduce gamification and rewards
- [x] Sites like Youtube.com/hash should only count YouTube
- [x] Optimize the code

Bugs:

- [x] Blocked page sends LOG_BREATHE but background has no handler, so breathe events are never recorded
- [x] Blocked page SAVE_REFLECTION payload doesn't match background handler (sends data.\* but handler expects message.text), so reflections are lost
- [x] Blocked page LOG_INTERRUPTION includes outcome but background ignores it, so outcome is always "stayed"
- [x] Popup expects GET_STATS.interruptionsResisted but background doesn't return it, so it shows 0/undefined

Future Features:

- [] Community
- [] Personalized Plan: AI feature (BYOK)
