+++
title = 'Contact Me'
date = 2023-10-23T15:27:29+02:00
draft = false
+++

{{< raw >}}
<form action="https://api.staticforms.xyz/submit" target="raw" method="POST">
  <input type="hidden" name="accessKey" value="037273a1-68ac-4e2c-9d59-aae8119d36c9">
  <br>
  <div class="mb-3 pt-0">
    <input type="text" placeholder="Your name" name="name" required />
  </div>
  <div class="mb-3 pt-0">
    <input type="email" placeholder="Email" name="email" required />
  </div>
  <br>
  <div class="mb-3 pt-0">
    <textarea placeholder="Your message" name="message" style="width:100%;height:120px;" required></textarea>
  </div>
  <div class="mb-3 pt-0">
    <button type="submit">Send message</button>
  </div>
  <!-- If we receive data in this field submission will be ignored -->
  <input type="text" name="honeypot" style="display: none;">
</form>
{{< /raw >}}

#
Or send me an email to [rogarmu8@gmail.com](mailto:rogarmu8@gmail.com)