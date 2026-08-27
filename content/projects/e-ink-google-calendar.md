---
order: 10
title: "E-Ink Google Calendar"
description: "ESP32 e-paper display that pulls the next 6 days from Google Calendar."
---

E-ink display that connects to Google Calendar, shows the next **6 days**, and refreshes every **24 hours** (or on reboot).

![E-ink calendar display](cover.jpg)

# Parts

- [Waveshare E-Paper ESP32 Driver Board](https://www.waveshare.com/wiki/E-Paper_ESP32_Driver_Board)
- [7.5" e-paper panel](https://www.waveshare.com/product/7.5inch-e-paper.htm)

# How it works

1. Google Apps Script reads the calendar and exposes the next days as HTML
2. ESP32 fetches that payload
3. Response is laid out for the e-paper panel
4. Waveshare Arduino libs draw the frame; restart forces a refresh anytime

[GitHub](https://github.com/rogarmu8/E-INK-Google-Calendar)
