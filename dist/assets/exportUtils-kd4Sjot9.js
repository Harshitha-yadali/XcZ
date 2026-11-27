import{E as O}from"./vendor-pdf-ySRa8UwX.js";import{i as H}from"./vendor-react-Br0Mxp9P.js";const M={layoutType:"standard",paperSize:"a4",fontFamily:"Calibri",nameSize:22,sectionHeaderSize:13,subHeaderSize:11,bodyTextSize:11,sectionSpacing:4,entrySpacing:2.5},at={"ats-optimized":{name:"ATS Optimized",description:"Maximum ATS compatibility with audit-compliant formatting",margins:{top:17.78,bottom:17.78,left:17.78,right:17.78},spacing:{section:4,entry:2.5},recommended:!0},standard:{name:"Standard",description:"Professional layout with optimal spacing",margins:{top:15,bottom:10,left:20,right:20},spacing:{section:4,entry:2.5},recommended:!1},compact:{name:"Compact",description:"Condensed layout for more content",margins:{top:10,bottom:5,left:15,right:15},spacing:{section:2.5,entry:1.5},recommended:!1}},U=t=>typeof t=="string"?t.trim():"",q=t=>{const n=t.match(/^(.*?)\s+[-–—]\s+(.+)$/);if(!n)return{title:t,description:""};const e=n[1].trim(),i=n[2].trim(),o=i.split(/\s+/).filter(Boolean);return!e||!/^[a-z]/.test(i)||o.length<3?{title:t,description:""}:{title:e,description:i}},Z=t=>{if(typeof t=="string")return q(t.trim());if(!t||typeof t!="object")return{title:"",description:""};const n=U(t.description),e=U(t.title)||U(t.name)||U(t.text)||U(t.value);return n?{title:e||n,description:e&&n!==e?n:""}:q(e)};var Q={exports:{}};(function(t,n){(function(e,i){i()})(H,function(){function e(a,l){return typeof l>"u"?l={autoBom:!1}:typeof l!="object"&&(console.warn("Deprecated: Expected third argument to be a object"),l={autoBom:!l}),l.autoBom&&/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\uFEFF",a],{type:a.type}):a}function i(a,l,g){var d=new XMLHttpRequest;d.open("GET",a),d.responseType="blob",d.onload=function(){p(d.response,l,g)},d.onerror=function(){console.error("could not download file")},d.send()}function o(a){var l=new XMLHttpRequest;l.open("HEAD",a,!1);try{l.send()}catch{}return 200<=l.status&&299>=l.status}function s(a){try{a.dispatchEvent(new MouseEvent("click"))}catch{var l=document.createEvent("MouseEvents");l.initMouseEvent("click",!0,!0,window,0,0,0,80,20,!1,!1,!1,!1,0,null),a.dispatchEvent(l)}}var r=typeof window=="object"&&window.window===window?window:typeof self=="object"&&self.self===self?self:typeof H=="object"&&H.global===H?H:void 0,c=r.navigator&&/Macintosh/.test(navigator.userAgent)&&/AppleWebKit/.test(navigator.userAgent)&&!/Safari/.test(navigator.userAgent),p=r.saveAs||(typeof window!="object"||window!==r?function(){}:"download"in HTMLAnchorElement.prototype&&!c?function(a,l,g){var d=r.URL||r.webkitURL,f=document.createElement("a");l=l||a.name||"download",f.download=l,f.rel="noopener",typeof a=="string"?(f.href=a,f.origin===location.origin?s(f):o(f.href)?i(a,l,g):s(f,f.target="_blank")):(f.href=d.createObjectURL(a),setTimeout(function(){d.revokeObjectURL(f.href)},4e4),setTimeout(function(){s(f)},0))}:"msSaveOrOpenBlob"in navigator?function(a,l,g){if(l=l||a.name||"download",typeof a!="string")navigator.msSaveOrOpenBlob(e(a,g),l);else if(o(a))i(a,l,g);else{var d=document.createElement("a");d.href=a,d.target="_blank",setTimeout(function(){s(d)})}}:function(a,l,g,d){if(d=d||open("","_blank"),d&&(d.document.title=d.document.body.innerText="downloading..."),typeof a=="string")return i(a,l,g);var f=a.type==="application/octet-stream",h=/constructor/i.test(r.HTMLElement)||r.safari,b=/CriOS\/[\d]+/.test(navigator.userAgent);if((b||f&&h||c)&&typeof FileReader<"u"){var m=new FileReader;m.onloadend=function(){var S=m.result;S=b?S:S.replace(/^data:[^;]*;/,"data:attachment/file;"),d?d.location.href=S:location=S,d=null},m.readAsDataURL(a)}else{var u=r.URL||r.webkitURL,x=u.createObjectURL(a);d?d.location=x:location.href=x,d=null,setTimeout(function(){u.revokeObjectURL(x)},4e4)}});r.saveAs=p.saveAs=p,t.exports=p})})(Q);var N=Q.exports;const _=t=>({"Times New Roman":"times",Arial:"helvetica",Verdana:"helvetica",Georgia:"times",Calibri:"helvetica",Helvetica:"helvetica",Courier:"courier","Courier New":"courier"})[t]||"helvetica",D=t=>{const n=t.paperSize==="letter";return{pageWidth:n?215.9:210,pageHeight:n?279.4:297,margins:{top:t.layoutType==="compact"?12:(t.layoutType==="ats-optimized",17.78),bottom:4,left:t.layoutType==="compact"?12:(t.layoutType==="ats-optimized",17.78),right:t.layoutType==="compact"?12:(t.layoutType==="ats-optimized",17.78)},get contentWidth(){return this.pageWidth-this.margins.left-this.margins.right},get contentHeight(){return this.pageHeight-this.margins.top-this.margins.bottom},fonts:{name:{size:t.nameSize,weight:"bold"},contact:{size:t.bodyTextSize-.5,weight:"normal"},sectionTitle:{size:t.sectionHeaderSize,weight:"bold"},jobTitle:{size:t.subHeaderSize,weight:"bold"},company:{size:t.subHeaderSize,weight:"normal"},year:{size:t.subHeaderSize,weight:"normal"},body:{size:t.bodyTextSize,weight:"normal"}},spacing:{nameFromTop:10,afterName:0,afterContact:2,sectionSpacingBefore:t.sectionSpacing,sectionSpacingAfter:2,bulletListSpacing:.5,afterSubsection:3,lineHeight:t.layoutType==="ats-optimized"?1.1:1.2,bulletIndent:5,entrySpacing:t.entrySpacing},colors:{primary:[0,0,0],secondary:[80,80,80],accent:[37,99,235]},fontFamily:_(t.fontFamily)}},y=(t,n="text")=>{if(!t||t.trim()==="")return!1;const e=t.trim().toLowerCase();if(["n/a","not specified","none"].includes(e))return!1;switch(n){case"phone":return(t.match(/\d/g)||[]).length>6;case"email":return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);case"url":return/^https?:\/\//.test(t)||/linkedin\.com\/in\//i.test(t)||/github\.com\//i.test(t)||/^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(t);case"text":default:return!0}},B=()=>/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),R=t=>{if(typeof t=="string")return t.trim();if(t==null)return"";if(typeof t=="object"){const n=["text","name","title","value"];for(const e of n){const i=t[e];if(typeof i=="string"&&i.trim())return i.trim()}return""}return String(t)},E=t=>{if(!t)return!0;const n=t.trim().toLowerCase();return n===""||n==="n/a"||n==="none"||n==="not specified"||n==="not provided"||n==="available upon request"},k=t=>{const n=Array.isArray(t.certifications)?t.certifications:[];if(n&&n.length>0)return n;const e=(t.additionalSections||[]).filter(o=>typeof(o==null?void 0:o.title)=="string"&&/cert|licen/i.test(o.title)).flatMap(o=>Array.isArray(o.bullets)?o.bullets:[]).filter(o=>typeof o=="string"&&o.trim().length>0);if(e.length>0)return e;const i=(t.skills||[]).filter(o=>typeof(o==null?void 0:o.category)=="string"&&/cert|licen/i.test(o.category)).flatMap(o=>Array.isArray(o.list)?o.list:[]).filter(o=>typeof o=="string"&&o.trim().length>0);return i.length>0?i:[]},C=(t,n)=>{try{if(B()){const e=URL.createObjectURL(t),i=document.createElement("a");i.href=e,i.download=n,i.style.display="none",document.body.appendChild(i),i.click(),document.body.removeChild(i),setTimeout(()=>{URL.revokeObjectURL(e)},1e3)}else N.saveAs(t,n)}catch(e){console.error("Download failed:",e);const i=URL.createObjectURL(t);window.open(i,"_blank"),setTimeout(()=>{URL.revokeObjectURL(i)},1e3)}};function w(t,n,e){const i=e.pageHeight-e.margins.bottom;return t.currentY+n<=i}function z(t,n){t.doc.addPage(),t.currentPage++,t.currentY=n.margins.top;const e=`Page ${t.currentPage}`;t.doc.setFont(n.fontFamily,"normal"),t.doc.setFontSize(9),t.doc.setTextColor(128,128,128);const i=t.doc.internal.pageSize.getWidth(),o=t.doc.getTextWidth(e);t.doc.text(e,i-n.margins.right-o,n.pageHeight-n.margins.bottom/2)}function v(t,n,e,i,o={}){const{fontSize:s=i.fonts.body.size,fontWeight:r="normal",color:c=i.colors.primary,maxWidth:p=i.contentWidth,align:a="left"}=o;console.log(`[drawText] Font: ${i.fontFamily}, Weight: ${r}, Size: ${s}pt, Text: "${n.substring(0,30)}..."`),t.doc.setFont(i.fontFamily,r),t.doc.setFontSize(s),t.doc.setTextColor(c[0],c[1],c[2]);const l=t.doc.splitTextToSize(n,p),g=s*i.spacing.lineHeight*.352778,d=l.length*g;w(t,d,i)||z(t,i);let f=e;return a==="center"?f=i.margins.left+i.contentWidth/2:a==="right"&&(f=i.margins.left+i.contentWidth),l.forEach((h,b)=>{const m=t.currentY+b*g;if(a==="center"){const u=t.doc.getTextWidth(h);t.doc.text(h,f-u/2,m)}else if(a==="right"){const u=t.doc.getTextWidth(h);t.doc.text(h,f-u,m)}else t.doc.text(h,f,m)}),t.currentY+=d,d}function A(t,n,e){const i=(n||[]).filter(s=>{if(typeof s=="string")return s.trim().length>0&&!E(s);if(s&&typeof s=="object"){const r=s,c=R(r),p=R(r==null?void 0:r.description);return!!c&&!E(c)||!!p&&!E(p)}return!1});if(!i.length)return 0;let o=T(t,"Certifications",e);return i.forEach(s=>{w(t,10,e)||z(t,e);const{title:r,description:c}=Z(s),p=r||c;if(p){const a=v(t,`• ${p}`,e.margins.left+e.spacing.bulletIndent,e,{fontWeight:"bold",maxWidth:e.contentWidth-e.spacing.bulletIndent});if(o+=a,c&&r&&c!==r){t.currentY+=1;const l=v(t,c,e.margins.left+e.spacing.bulletIndent*2,e,{maxWidth:e.contentWidth-e.spacing.bulletIndent*2});o+=l+1}}t.currentY+=e.spacing.bulletListSpacing}),o}function T(t,n,e){const i=e.fonts.sectionTitle.size*e.spacing.lineHeight*.352778,r=1+i+1+e.spacing.sectionSpacingAfter+5;w(t,r,e)||z(t,e),t.currentY+=1,t.doc.setFont(e.fontFamily,"bold"),t.doc.setFontSize(e.fonts.sectionTitle.size),t.doc.setTextColor(e.colors.primary[0],e.colors.primary[1],e.colors.primary[2]);const c=n.toUpperCase();t.doc.text(c,e.margins.left,t.currentY),t.currentY+=i;const p=t.currentY-e.fonts.sectionTitle.size*.2;return t.doc.setDrawColor(64,64,64),t.doc.setLineWidth(.25),t.doc.line(e.margins.left,p,e.margins.left+e.contentWidth,p),t.currentY+=e.spacing.sectionSpacingAfter,i+e.spacing.sectionSpacingBefore+e.spacing.sectionSpacingAfter}function J(t,n){if(!t)return"";const e=t.trim().toLowerCase();if(n==="linkedin"){const i=e.match(/linkedin\.com\/in\/([^\/\?]+)/i);return i?`linkedin/${i[1]}`:"LinkedIn"}if(n==="github"){const i=e.match(/github\.com\/([^\/\?]+)/i);return i?`github/${i[1]}`:"GitHub"}return t}function F(t,n,e){const i=[],o=[];if(y(n.phone,"phone")&&i.push({text:n.phone,url:`tel:${n.phone}`}),y(n.email,"email")&&i.push({text:n.email,url:`mailto:${n.email}`}),y(n.linkedin,"url")){const l=n.linkedin.startsWith("http")?n.linkedin:`https://${n.linkedin}`,g=J(n.linkedin,"linkedin");i.push({text:g,url:l})}if(y(n.github,"url")){const l=n.github.startsWith("http")?n.github:`https://${n.github}`,g=J(n.github,"github");i.push({text:g,url:l})}if(i.length===0&&o.length===0)return 0;t.doc.setFont(e.fontFamily,"bold"),t.doc.setFontSize(e.fonts.contact.size),t.doc.setTextColor(e.colors.primary[0],e.colors.primary[1],e.colors.primary[2]);const s=" | ",r=t.doc.getTextWidth(s),c=e.fonts.contact.size*e.spacing.lineHeight*.352778;let p=0;return(l=>{if(l.length===0)return;let g=0;l.forEach((f,h)=>{g+=t.doc.getTextWidth(f.text),h<l.length-1&&(g+=r)});let d=e.margins.left+(e.contentWidth-g)/2;l.forEach((f,h)=>{const b=t.doc.getTextWidth(f.text);if(t.doc.text(f.text,d,t.currentY),f.url){const m=e.fonts.contact.size*.352778;t.doc.link(d,t.currentY-m+1,b,m+1,{url:f.url})}d+=b,h<l.length-1&&(t.doc.text(s,d,t.currentY),d+=r)}),t.currentY+=c,p+=c})(i),t.doc.setFont(e.fontFamily,"normal"),t.currentY+=e.spacing.afterContact,p+=e.spacing.afterContact,p}function Y(t,n,e="experienced",i){if(!n||n.length===0)return 0;t.currentY+=1.5;let s=T(t,e==="fresher"||e==="student"?"Work Experience":"Professional Experience",i)+1.5;return n.forEach((r,c)=>{const p=i.fonts.jobTitle.size*i.spacing.lineHeight*.352778,a=i.fonts.body.size*i.spacing.lineHeight*.352778;w(t,p+a+i.spacing.bulletListSpacing*2+i.spacing.afterSubsection,i)||z(t,i);const l=t.currentY,g=`${r.role} | ${r.company}${y(r.location)?`, ${r.location}`:""}`,d=r.year;if(y(d)){t.doc.setFont(i.fontFamily,"bold"),t.doc.setFontSize(i.fonts.year.size);const f=t.doc.getTextWidth(d),h=i.margins.left+i.contentWidth-f,b=l-.5;t.doc.text(d,h,b),t.doc.setFont(i.fontFamily,"normal")}v(t,g,i.margins.left,i,{fontSize:i.fonts.jobTitle.size,fontWeight:"bold",maxWidth:i.contentWidth-(y(d)?t.doc.getTextWidth(d):0)-5}),t.currentY+=i.spacing.bulletListSpacing,r.bullets&&r.bullets.length>0&&(t.currentY+=i.spacing.bulletListSpacing,r.bullets.forEach(f=>{const h=`• ${f}`,b=v(t,h,i.margins.left+i.spacing.bulletIndent,i,{fontSize:i.fonts.body.size,maxWidth:i.contentWidth-i.spacing.bulletIndent});s+=b}),t.currentY+=i.spacing.bulletListSpacing),c<n.length-1&&(t.currentY+=1,s+=1)}),s}function L(t,n,e){if(!n||n.length===0)return 0;let i=T(t,"Education",e);return n.forEach((o,s)=>{const r=t.currentY;w(t,20,e)||z(t,e);const c=v(t,o.degree,e.margins.left,e,{fontSize:e.fonts.jobTitle.size,fontWeight:e.fonts.jobTitle.weight}),p=`${o.school}${y(o.location)?`, ${o.location}`:""}`,a=v(t,p,e.margins.left,e,{fontSize:e.fonts.company.size,fontWeight:"normal",color:e.colors.primary});let l=0;if(y(o.cgpa)&&(l=v(t,`CGPA: ${o.cgpa}`,e.margins.left,e,{fontSize:e.fonts.body.size,fontWeight:e.fonts.body.weight,color:e.colors.secondary})),t.doc.setFontSize(e.fonts.year.size),t.doc.setTextColor(e.colors.primary[0],e.colors.primary[1],e.colors.primary[2]),y(o.year)){const g=o.year;t.doc.setFont(e.fontFamily,"bold");const d=t.doc.getTextWidth(g),f=e.margins.left+e.contentWidth-d,h=r-.5;t.doc.text(g,f,h),t.doc.setFont(e.fontFamily,"normal")}i+=c+a+l,s<n.length-1&&(t.currentY+=1,i+=1)}),i}function j(t,n,e){if(!n||n.length===0)return 0;n.filter(o=>o.githubUrl);let i=T(t,"Projects",e);return n.forEach((o,s)=>{w(t,25,e)||z(t,e);const r=v(t,o.title,e.margins.left,e,{fontSize:e.fonts.jobTitle.size,fontWeight:e.fonts.jobTitle.weight});i+=r,t.currentY+=e.spacing.bulletListSpacing,o.bullets&&o.bullets.length>0&&(t.currentY+=e.spacing.bulletListSpacing,o.bullets.forEach(c=>{const p=`• ${c}`,a=v(t,p,e.margins.left+e.spacing.bulletIndent,e,{fontSize:e.fonts.body.size,maxWidth:e.contentWidth-e.spacing.bulletIndent});i+=a}),t.currentY+=e.spacing.bulletListSpacing),s<n.length-1&&(t.currentY+=1,i+=1)}),i}function V(t,n,e){if(!n||n.length===0)return 0;let i=T(t,"Skills",e);const o=e.fonts.body.size*e.spacing.lineHeight*.352778;return n.forEach((s,r)=>{w(t,15,e)||z(t,e);const c=e.margins.left,p=`${s.category}: `,a=s.list?s.list.join(", "):"";t.doc.setFont(e.fontFamily,"bold"),t.doc.setFontSize(e.fonts.body.size),t.doc.setTextColor(e.colors.primary[0],e.colors.primary[1],e.colors.primary[2]);const l=t.doc.getTextWidth(p);t.doc.text(p,c,t.currentY),t.doc.setFont(e.fontFamily,"normal");const g=e.contentWidth-l,d=t.doc.splitTextToSize(a,g);d.forEach((f,h)=>{h===0?t.doc.text(f,c+l,t.currentY):t.doc.text(f,c,t.currentY+h*o)}),t.currentY+=d.length*o,i+=d.length*o,r<n.length-1&&(t.currentY+=1,i+=1)}),i}function tt(t,n,e){if(!n)return 0;let i=T(t,"Professional Summary",e);const o=v(t,n,e.margins.left,e,{fontSize:e.fonts.body.size,fontWeight:e.fonts.body.weight,maxWidth:e.contentWidth});return i+=o,t.currentY+=3,i}function et(t,n,e){if(!n)return 0;let i=T(t,"Career Objective",e);t.currentY+=3;const o=v(t,n,e.margins.left,e,{fontSize:e.fonts.body.size,fontWeight:e.fonts.body.weight,maxWidth:e.contentWidth});return i+=o,t.currentY+=3,i}function K(t,n,e){if(!(n.achievements&&n.achievements.length>0))return 0;let o=T(t,"Achievements",e);return n.achievements.forEach(s=>{w(t,10,e)||z(t,e);const r=v(t,`• ${s}`,e.margins.left+e.spacing.bulletIndent,e,{fontSize:e.fonts.body.size,maxWidth:e.contentWidth-e.spacing.bulletIndent});o+=r}),t.currentY+=2,o}function it(t,n,e){if(!n||!n.title||!n.bullets||n.bullets.length===0)return 0;let i=T(t,n.title,e);return n.bullets.forEach(o=>{w(t,10,e)||z(t,e);const s=v(t,`• ${o}`,e.margins.left+e.spacing.bulletIndent,e,{fontSize:e.fonts.body.size,maxWidth:e.contentWidth-e.spacing.bulletIndent});i+=s}),t.currentY+=2,i}const I=async(t,n="experienced",e=M)=>{if(!t)throw new Error("Resume data is required for PDF export");if(!t.name||t.name.trim()==="")throw new Error("Resume must have a name to export");console.log("🔴 EXPORT PDF CALLED WITH OPTIONS:",{fontFamily:e.fontFamily,nameSize:e.nameSize,bodyTextSize:e.bodyTextSize,sectionHeaderSize:e.sectionHeaderSize});const i=D(e);console.log("🔵 PDF_CONFIG CREATED:",{fontFamily:i.fontFamily,nameSize:i.fonts.name.size,bodySize:i.fonts.body.size,sectionSize:i.fonts.sectionTitle.size});try{B()&&console.log("Starting PDF generation for mobile device..."),console.log("═══════════════════════════════════════════════════════════"),console.log("📄 PDF EXPORT - OPTIONS RECEIVED"),console.log("═══════════════════════════════════════════════════════════"),console.log("Export options:",JSON.stringify(e,null,2)),console.log("Paper size:",e.paperSize),console.log("Font family (original):",e.fontFamily),console.log("Font family (mapped):",i.fontFamily),console.log("Font sizes:"),console.log("  - Name:",e.nameSize,"→ PDF_CONFIG:",i.fonts.name.size),console.log("  - Section Header:",e.sectionHeaderSize,"→ PDF_CONFIG:",i.fonts.sectionTitle.size),console.log("  - Sub Header:",e.subHeaderSize,"→ PDF_CONFIG:",i.fonts.jobTitle.size),console.log("  - Body Text:",e.bodyTextSize,"→ PDF_CONFIG:",i.fonts.body.size),console.log("Spacing:"),console.log("  - Section:",e.sectionSpacing,"→ PDF_CONFIG:",i.spacing.sectionSpacingBefore),console.log("  - Entry:",e.entrySpacing,"→ PDF_CONFIG:",i.spacing.entrySpacing),console.log("═══════════════════════════════════════════════════════════");const o=e.paperSize==="letter"?"letter":"a4",s=new O({orientation:"portrait",unit:"mm",format:o,compress:!0});console.log(`[PDF] Initializing font: ${i.fontFamily}`),s.setFont(i.fontFamily,"normal"),s.setFontSize(i.fonts.body.size);const r={currentPage:1,currentY:i.margins.top,doc:s};s.setProperties({title:`${t.name} - Resume`,subject:"Professional Resume",author:t.name,creator:"Resume Optimizer"}),r.currentY=i.spacing.nameFromTop,v(r,t.name.toUpperCase(),i.margins.left,i,{fontSize:i.fonts.name.size,fontWeight:i.fonts.name.weight,align:"center"}),r.currentY+=i.spacing.afterName,F(r,t,i),r.currentY+=3,n==="experienced"&&t.summary&&t.summary.trim()!==""?tt(r,t.summary,i):(n==="student"||n==="fresher")&&t.careerObjective&&t.careerObjective.trim()!==""&&et(r,t.careerObjective,i);const c=(a,l)=>{try{l()}catch(g){console.error(`[PDF] Section failed: ${a}`,g)}};n==="experienced"?(c("Skills",()=>V(r,t.skills,i)),c("WorkExperience",()=>Y(r,t.workExperience,n,i)),c("Projects",()=>j(r,t.projects,i)),c("Education",()=>L(r,t.education,i)),c("Certifications",()=>A(r,k(t),i))):n==="student"?(c("Education",()=>L(r,t.education,i)),c("Skills",()=>V(r,t.skills,i)),c("Projects",()=>j(r,t.projects,i)),c("WorkExperience",()=>Y(r,t.workExperience,n,i)),c("Certifications",()=>A(r,k(t),i)),c("Achievements",()=>K(r,t,i))):(c("Skills",()=>V(r,t.skills,i)),c("WorkExperience",()=>Y(r,t.workExperience,n,i)),c("Projects",()=>j(r,t.projects,i)),c("Education",()=>L(r,t.education,i)),c("Certifications",()=>A(r,k(t),i)),c("Achievements",()=>K(r,t,i))),t.additionalSections&&t.additionalSections.length>0&&t.additionalSections.forEach(a=>{it(r,a,i)});const p=r.currentPage;if(p>1)for(let a=1;a<=p;a++){a>1&&s.setPage(a);const l=`Page ${a} of ${p}`;s.setFont(i.fontFamily,"normal"),s.setFontSize(9),s.setTextColor(80,80,80);const g=s.getTextWidth(l);s.text(l,i.pageWidth/2-g/2,i.pageHeight-i.margins.bottom/2)}return s}catch(o){throw console.error("Error exporting to PDF:",o),o instanceof Error?o.message.includes("jsPDF")?new Error("PDF generation failed. Please try again or contact support if the issue persists."):new Error("An error occurred while creating the PDF. Please try again."):new Error("An unexpected error occurred while exporting PDF. Please try again.")}},lt=async(t,n="experienced",e=M)=>{const i=await I(t,n,e),o=P(t,"pdf");B()?C(i.output("blob"),o):i.save(o)},st=async(t,n="experienced",e=M)=>(await I(t,n,e)).output("blob"),P=(t,n)=>{const e=t.name.replace(/\s+/g,"_"),i=t.targetRole?`_${t.targetRole.replace(/\s+/g,"_")}`:"";return`${e}${i}_Resume.${n}`},ct=async(t,n="experienced")=>{if(!t)throw new Error("Resume data is required for Word export");if(!t.name||t.name.trim()==="")throw new Error("Resume must have a name to export");const e=P(t,"doc");try{console.log("Generating Word document...");const i=nt(t,n);console.log("Word HTML content generated successfully");const o=new Blob([i],{type:"application/vnd.ms-word"});C(o,e),console.log("Word document downloaded successfully")}catch(i){throw console.error("Error exporting to Word:",i),i instanceof Error?new Error(`Word export failed: ${i.message}`):new Error("Word export failed. Please try again.")}},nt=(t,n="experienced")=>{const e=[],i=(m,u,x="text",S)=>{if(!u)return;const X=u.split(/[,|]/).map(W=>W.trim()).filter(W=>y(W,x));if(X.length>0){const W=X.map($=>S==="tel"?`<a href="tel:${$}" style="color: #2563eb !important; text-decoration: underline !important;">${$}</a>`:S==="mailto"?`<a href="mailto:${$}" style="color: #2563eb !important; text-decoration: underline !important;">${$}</a>`:S==="http"?`<a href="${$}" target="_blank" rel="noopener noreferrer" style="color: #2563eb !important; text-decoration: underline !important;">${$}</a>`:$).join(" | ");e.push(`${W}`)}};i("Phone no",t.phone,"phone","tel"),i("Email",t.email,"email","mailto"),i("LinkedIn",t.linkedin,"url","http"),i("GitHub",t.github,"url","http");const o=e.join(" | "),s=t.summary?`
  <div style="margin-top: 5pt;">
    <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PROFESSIONAL SUMMARY</div>
    <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
    <p style="margin-bottom: 12pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt;">${t.summary}</p>
  </div>
`:"",r=t.education&&t.education.length>0?`
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">EDUCATION</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${t.education.map(m=>`
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2pt;">
          <tr>
            <td style="padding: 0; vertical-align: top; text-align: left;">
              <div class="degree" style="font-size: 9.5pt; font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m.degree}</div>
              <div class="school" style="font-size: 9.5pt; font-weight: normal; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m.school}${y(m.location)?`, ${m.location}`:""}</div>
              ${y(m.cgpa)?`<div style="font-size: 9.5pt; color: #4B5563; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CGPA: ${m.cgpa}</div>`:""}
            </td>
            <td style="padding: 0; vertical-align: top; text-align: right; white-space: nowrap;">
              <div class="year" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: bold;">${m.year}</div>
            </td>
          </tr>
        </table>
      `).join("")}
    </div>
  `:"",c=t.workExperience&&t.workExperience.length>0?`
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${n==="fresher"?"WORK EXPERIENCE":"EXPERIENCE"}</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${t.workExperience.map(m=>`
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1pt;">
          <tr>
            <td style="padding: 0; vertical-align: top; text-align: left;">
              <div class="job-title" style="font-size: 9.5pt; font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m.role} | ${m.company}${y(m.location)?`, ${m.location}`:""}</div>
            </td>
            <td style="padding: 0; vertical-align: top; text-align: right; white-space: nowrap;">
              <div class="year" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: normal;">${m.year}</div>
            </td>
          </tr>
        </table>
        ${m.bullets&&m.bullets.length>0?`
          <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
            ${m.bullets.map(u=>`<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${u}</li>`).join("")}
          </ul>
        `:""}
      `).join("")}
    </div>
  `:"",p=t.projects&&t.projects.length>0?`
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PROJECTS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${t.projects.map(m=>`
        <div style="margin-bottom: 6pt;">
          <div class="project-title" style="font-size: 9.5pt; font-weight: bold; margin-bottom: 1pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m.title}</div>
          ${m.bullets&&m.bullets.length>0?`
            <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
              ${m.bullets.map(u=>`<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${u}</li>`).join("")}
            </ul>
          `:""}
        </div>
      `).join("")}
    </div>
  `:"",a=t.skills&&t.skills.length>0?`
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">SKILLS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${t.skills.map(m=>`
        <div class="skills-item" style="font-size: 9.5pt; margin: 0.5pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <span class="skill-category" style="font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m.category}:</span> ${m.list?m.list.join(", "):""}
        </div>
      `).join("")}
    </div>
  `:"",l=k(t),g=l&&l.length>0?`
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CERTIFICATIONS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 6pt; list-style-type: disc;">
        ${l.filter(m=>typeof m=="string"?String(m).trim().length>0&&!E(String(m)):m&&(!E(R(m))||!E(R(m.description)))).map(m=>{const{title:u,description:x}=Z(m);return`<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 4pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${x&&u?`
            <div style="font-weight: bold; margin-bottom: 2pt;">${u}</div>
            <div style="font-size: 8.5pt; font-weight: normal; color: #4a5568; margin-left: 3mm; line-height: 1.3;">${x}</div>
          `:u||x}</li>`}).join("")}
      </ul>
    </div>
  `:"",d=t.achievements&&t.achievements.length>0?`
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">ACHIEVEMENTS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      <ul class="bullets" style="margin-left: 7.5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
        ${t.achievements.map(m=>`<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m}</li>`).join("")}
      </ul>
    </div>
  `:"";let f="";const h=t.careerObjective&&t.careerObjective.trim()!==""?`
  <div style="margin-top: 5pt;">
    <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CAREER OBJECTIVE</div>
    <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
    <p style="margin-bottom: 12pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt;">${t.careerObjective}</p>
  </div>
`:"",b=t.additionalSections&&t.additionalSections.length>0?`
    ${t.additionalSections.map(m=>`
      <div style="margin-top: 5pt;">
        <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${m.title.toUpperCase()}</div>
        <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
        <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
          ${m.bullets.map(u=>`<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${u}</li>`).join("")}
        </ul>
      </div>
    `).join("")}
  `:"";return n==="experienced"?f=`
      ${s}
      ${a}
      ${c}
      ${p}
      ${r}
      ${g}
      ${b}
    `:n==="student"?f=`
      ${h}
      ${r}
      ${a}
      ${p}
      ${c}
      ${g}
      ${d}
      ${b}
    `:f=`
      ${h}
      ${a}
      ${c}
      ${p}
      ${r}
      ${g}
      ${d}
      ${b}
    `,`
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <meta name="ProgId" content="Word.Document">
      <meta name="Generator" content="Microsoft Word 15">
      <meta name="Originator" content="Microsoft Word 15">
      <title>${t.name} - Resume</title>
      <style>
        @page {
          margin-top: 17.78mm !important; /* ~0.7 inch */
          margin-bottom: 17.78mm !important; /* ~0.7 inch */
          margin-left: 17.78mm !important; /* ~0.7 inch */
          margin-right: 17.78mm !important; /* ~0.7 inch */
        }

        body {
          font-family: "Calibri", sans-serif !important;
          font-size: 10pt !important;
          line-height: 1.25 !important;
          color: #000 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }

        a, a:link, a:visited, a:active {
          color: #2563eb !important;
          text-decoration: underline !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
          font-weight: inherit !important;
          font-size: inherit !important;
        }

        a:hover {
          color: #1d4ed8 !important;
          text-decoration: underline !important;
        }

        b, strong {
          font-weight: bold !important;
          color: #000 !important;
        }

        .header {
          text-align: center !important;
          margin-bottom: 6mm !important;
        }
        .name {
          font-size: 18pt !important;
          font-weight: bold !important;
          letter-spacing: 1pt !important;
          margin-bottom: 4pt !important;
          text-transform: uppercase !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .contact {
          font-size: 9pt !important;
          margin-bottom: 6pt !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .header-line {
          border: none !important;
          border-top: 0.5pt solid #404040 !important;
          margin: 0 0 !important; /* Remove horizontal margin */
          height: 1px !important;
          width: 100% !important; /* Ensure line spans full content width */
        }
        .section-title {
          font-size: 10pt !important;
          font-weight: bold !important;
          margin-top: 10pt !important;
          margin-bottom: 4pt !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5pt !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .section-underline {
          border-bottom: 0.5pt solid #808080 !important;
          margin-bottom: 4pt !important;
          height: 1px !important;
        }
        /* Removed .job-header, .edu-header flex styles as they are replaced by table */
        .job-title, .degree {
          font-size: 9.5pt !important;
          font-weight: bold !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .company, .school {
          font-size: 9.5pt !important;
          font-weight: normal !important; /* Changed to normal */
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .year {
          font-size: 9.5pt !important;
          font-weight: bold !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .bullets {
          margin-left: 5mm !important; /* Changed from 4mm to 5mm */
          margin-bottom: 4pt !important;
          margin-top: 2pt !important;
        }
        .bullet {
          font-size: 9.5pt !important;
          line-height: 1.25 !important; /* Changed from 1.4 to 1.25 */
          margin: 0 0 1pt 0 !important; /* Changed from 2pt to 1pt */
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .skills-item {
          font-size: 9.5pt !important;
          margin: 1.5pt 0 !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .skill-category {
          font-weight: bold !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .project-title {
          font-size: 9.5pt !important;
          font-weight: bold !important;
          margin-bottom: 2pt !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }

        @media print {
          body { margin: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="name">${t.name.toUpperCase()}</div>
        ${o?`<div class="contact">${o}</div>`:""}
        
      </div>

      ${f}

    </body>
    </html>
  `};export{ct as a,st as b,M as d,lt as e,Z as g,at as l};
