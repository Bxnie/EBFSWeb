Electric Bristol — Front Screen Loop
=====================================

Drop this folder into Netlify (drag-and-drop deploy or connect to a repo)
and it will serve `index.html` as the front screen loop.

Updating tonight's show
-----------------------
Edit `current-event.json`:

  {
    "name": "Wasia Project",
    "date": "2026-05-16",
    "door_time": "7:00 PM",
    "image": "event images/wasia-project.jpg"
  }

- `name`        – artist / event name displayed under the panel
- `date`        – ISO date (YYYY-MM-DD), used for the "FRIDAY 16 MAY" line
- `door_time`   – door time string shown on the slide
- `image`       – path (relative to the site root) to the poster image

If `current-event.json` is missing or invalid the loop falls back to the
next event from `ticket-data.json`.

Updating upcoming shows
-----------------------
Replace `ticket-data.json` with a fresh export. Format is unchanged.

Keyboard
--------
F        toggle fullscreen
