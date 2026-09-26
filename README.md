# isSlop

Tired of seeing purely ai generated images with little soul on websites flooded with them like linkedin and youtube? This extension is for people who are in agreement of this, this also works for websites besides youtube and linkedin.

Everything runs on-device (ONNX inference + metadata forensics + C2PA content
credentials). Because I will not be going with the pay $5 dollar route in uploading this to chrome store below are instructions on how you can unpack this locally on your chrome browser. The model was taken from https://github.com/Phineas1500/sieve-ai-image-detector and a lot of logic derived from that project. The model is not perfect, and not every image has useful metadata or C2PA markers so model can be inaccurate, there is a white out option for Linkedin and Youtube for everysingle image as a total censorship option. By doing that you'll never see a slop image technically :p.

## Installation Guide

- Download the latest release zip file which is the extension + the model

- Then in manage extensions on chrome turn on developer mode
- Press load unpacked and then used the directory of where you extracted the zip file of the extension

## Classifier Model Information

40 mbs ONNX model that has been quantised to 16 floating point integers. Uses webgpu, and web assembly to load balance to cpu and gpu and convert ONNX graphs to gpu shaders.
## Images

<div align="center">
  <img width="575" height="1233" alt="Image" src="https://github.com/user-attachments/assets/3ac4a493-f307-4adf-882c-e926be95b18f" />
  <p><i>Linkedin</i></p>
</div>


<div align="center">
  <img width="369" height="292" alt="Image" src="https://github.com/user-attachments/assets/18e90371-f921-4c7c-8d87-865889e8626f" />
  <p><i>Extension UI</i></p>
</div>


<div align="center">
  <img width="1779" height="887" alt="Image" src="https://github.com/user-attachments/assets/b1147ef8-ffaa-4b55-86e4-229c9e01c111" />
  <p><i>Example Sites Other Than Linkedin and Youtube</i></p>
</div>

<div align="center">
  <img width="533" height="1250" alt="Image" src="https://github.com/user-attachments/assets/072a1023-33bf-4ea2-9785-3b230ebd1aa7" />
  <p><i>White Out Option</i></p>
</div>

