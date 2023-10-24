---
weight: 2
title: "Basic 3D Engine"
date: 2021-05-05T15:58:26+08:00
lastmod: 2021-05-05T15:58:26+08:00
draft: false
author: "Rómulo García"
description: ""
subtitle: "Assignments made during my year abroad at Utrecht University in the info graphics course using OpenTK and C#."
images: []
resources:
- name: "featured-image"
  src: "featured-image.jpg"
- name: "featured-image-preview"
  src: "featured-image-preview.jpg"
---

First assignment consisting of a Whitted-style ray tracer. This is a
recursive rendering algorithm for determining light transport between one or
more light sources and a camera, via scene surfaces, by tracing rays backwards
into the scene, starting at the camera.

![Image](image0.jpg)

Second assignment consisting of a basic 3D engine. The 3D engine is a tool
to visualize a scene graph: a hierarchy of meshes, each of which can have a unique
local transform. Each mesh will have a texture and a shader. The input for the
shader includes a set of light sources. The shading model implemented in the
fragment shader determines the response of the materials to these lights. Moreover, some postprocessing techniques such as anti-aliasing are also implemented.


{{< style "text-align:center !important;" >}}
[Github Link](https://github.com/rogarmu8/Graphics)
{{< /style >}}