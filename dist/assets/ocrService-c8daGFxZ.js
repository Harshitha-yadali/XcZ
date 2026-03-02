const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/mistralOCRService-DJVx10U5.js","assets/edenAITextService-Bimr23EQ.js","assets/aiProxyService-DzMwr7OW.js","assets/index-NlwF7PvK.js","assets/vendor-motion-_XdJ9pBm.js","assets/vendor-react-B4msnGgW.js","assets/vendor-pdf-B1igRwBP.js","assets/vendor-supabase-B_87WqdG.js","assets/vendor-forms-BxTF4-4_.js","assets/index-4sr46CPL.css"])))=>i.map(i=>d[i]);
import{_ as i}from"./vendor-pdf-B1igRwBP.js";import"./vendor-react-B4msnGgW.js";class s{async extractTextFromImage(e,t=!1){const r=Date.now();try{if(t)return await this.extractWithMistralOCR(e);const a=await this.preprocessImage(e),n=await this.performOCR(a),c=Date.now()-r;return{text:n.text,confidence:n.confidence,characterAccuracy:this.calculateCharacterAccuracy(n.text),boundingBoxes:n.boundingBoxes,detectedLanguage:n.detectedLanguage||"en",processingTime:c,imagePreprocessed:!0}}catch(a){return console.error("OCR extraction failed:",a),{text:"",confidence:0,characterAccuracy:0,boundingBoxes:[],detectedLanguage:"en",processingTime:Date.now()-r,imagePreprocessed:!1}}}async extractWithMistralOCR(e){try{const{mistralOCRService:t}=await i(async()=>{const{mistralOCRService:a}=await import("./mistralOCRService-DJVx10U5.js");return{mistralOCRService:a}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9]));console.log("🔍 Using enhanced Mistral OCR + GPT-4o-mini processing...");const r=await t.extractTextFromImage(e);return console.log(`✅ Enhanced OCR completed with ${r.confidence}% confidence`),r}catch(t){console.error("Enhanced Mistral OCR failed, falling back to basic OCR:",t);const r=Date.now(),a=await this.preprocessImage(e),n=await this.performOCR(a),c=Date.now()-r;return{text:n.text,confidence:n.confidence*.8,characterAccuracy:this.calculateCharacterAccuracy(n.text),boundingBoxes:n.boundingBoxes,detectedLanguage:n.detectedLanguage||"en",processingTime:c,imagePreprocessed:!0}}}async preprocessImage(e){try{return e}catch(t){return console.error("Image preprocessing failed:",t),e}}assessOCRQuality(e){const t=[],r=[];e.confidence<70&&(t.push("Low OCR confidence detected"),r.push("Consider using a higher quality image or different file format")),e.characterAccuracy<80&&(t.push("Character recognition accuracy is below optimal threshold"),r.push("Ensure image has clear, readable text without distortion")),e.text.length<100&&(t.push("Very little text extracted from image"),r.push("Verify that the image contains readable text content")),e.processingTime>2e4&&(t.push("OCR processing took longer than expected"),r.push("Consider optimizing image size or format"));let a=100;return a-=Math.max(0,(80-e.confidence)*.5),a-=Math.max(0,(85-e.characterAccuracy)*.3),e.text.length<100&&(a-=20),e.imagePreprocessed||(a-=10),{score:Math.max(0,Math.min(100,a)),issues:t,recommendations:r}}async performOCR(e){await new Promise(a=>setTimeout(a,100));const t=this.generateMockOCRText(),r=this.calculateMockConfidence(e);return{text:t,confidence:r,boundingBoxes:this.generateMockBoundingBoxes(t),detectedLanguage:"en"}}calculateCharacterAccuracy(e){if(!e||e.length===0)return 0;let t=95;[/[^\w\s\-.,;:!?()[\]{}'"@#$%^&*+=<>\/\\|`~]/g,/\w{25,}/g,/[0O]{3,}/g,/[Il1]{3,}/g,/\s{5,}/g].forEach(c=>{const o=e.match(c);o&&(t-=o.length*2)});const a=e.split(/\s+/).filter(c=>c.length>0),n=a.reduce((c,o)=>c+o.length,0)/a.length;return(n>15||n<2)&&(t-=10),Math.max(0,Math.min(100,t))}generateMockOCRText(){return`JOHN DOE
Software Engineer

CONTACT INFORMATION
Email: john.doe@email.com
Phone: (555) 123-4567
LinkedIn: linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years of experience in full-stack development.
Proficient in JavaScript, Python, and cloud technologies.

WORK EXPERIENCE
Senior Software Engineer | Tech Company | 2020-Present
• Developed and maintained web applications using React and Node.js
• Improved application performance by 40% through optimization
• Led a team of 3 junior developers

Software Engineer | Previous Company | 2018-2020
• Built RESTful APIs using Python and Django
• Implemented automated testing reducing bugs by 30%
• Collaborated with cross-functional teams

EDUCATION
Bachelor of Science in Computer Science
University Name | 2018

SKILLS
• Programming: JavaScript, Python, Java, TypeScript
• Frameworks: React, Node.js, Django, Express
• Databases: PostgreSQL, MongoDB, Redis
• Cloud: AWS, Docker, Kubernetes`}calculateMockConfidence(e){const t=e.length;let r=85;return t>1e6?r+=10:t<1e5&&(r-=15),r+=(Math.random()-.5)*10,Math.max(60,Math.min(95,r))}generateMockBoundingBoxes(e){const t=e.split(`
`).filter(a=>a.trim().length>0),r=[];return t.forEach((a,n)=>{r.push({x:50,y:50+n*25,width:Math.min(500,a.length*8),height:20})}),r}getOCRQuality(e){return{characterAccuracy:e.characterAccuracy,wordAccuracy:this.calculateWordAccuracy(e.text),confidence:e.confidence,imageQuality:this.assessImageQuality(e),textClarity:this.assessTextClarity(e.text)}}calculateWordAccuracy(e){const t=e.split(/\s+/).filter(a=>a.length>0);if(t.length===0)return 0;let r=0;return t.forEach(a=>{(a.match(/[a-zA-Z]/g)||[]).length/a.length>.7&&r++}),r/t.length*100}assessImageQuality(e){let t=e.confidence;return e.processingTime<5e3?t+=5:e.processingTime>15e3&&(t-=10),e.text.length>1e3?t+=5:e.text.length<100&&(t-=15),Math.max(0,Math.min(100,t))}assessTextClarity(e){if(!e||e.length===0)return 0;let t=90;return[/[^\w\s\-.,;:!?()[\]{}'"@#$%^&*+=<>\/\\|`~]/g,/\w{20,}/g,/[0O]{4,}/g,/\s{3,}/g].forEach(a=>{const n=e.match(a);n&&(t-=n.length*3)}),Math.max(0,Math.min(100,t))}detectOCRRequirement(e){return["image/jpeg","image/jpg","image/png","image/tiff","image/bmp"].includes(e.type.toLowerCase())?!0:e.type==="application/pdf"?e.size>5e6:!1}async routeDocumentExtraction(e){return this.detectOCRRequirement(e)?{extractionMode:"OCR",requiresOCR:!0,recommendedStrategy:"ocr"}:e.type==="application/pdf"&&e.size>1e6?{extractionMode:"HYBRID",requiresOCR:!1,recommendedStrategy:"hybrid"}:{extractionMode:"TEXT",requiresOCR:!1,recommendedStrategy:"direct"}}}const h=new s;export{s as OCRService,h as ocrService};
