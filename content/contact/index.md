+++
title = 'Contact Me'
date = 2023-10-23T15:27:29+02:00
draft = false
+++

{{< raw >}}
<style>
body {font-family: Arial, Helvetica, sans-serif;}
* {box-sizing: border-box;}

input[type=text], select, textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  margin-top: 6px;
  margin-bottom: 16px;
  resize: vertical;
}
input[type=email], select, textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  margin-top: 6px;
  margin-bottom: 16px;
  resize: vertical;
}

button[type=submit] {
  background-color: #7e7e7e;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button[type=submit]:hover {
  background-color: #282828;
}


</style>
<iframe name="dummyframe" id="dummyframe" style="display: none;"></iframe>

<form id="contact-form" action="https://api.staticforms.xyz/submit" target="dummyframe" method="POST" onsubmit="alert('you submitted the form');">
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