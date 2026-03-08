var u=Object.defineProperty;var g=(s,e,t)=>e in s?u(s,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):s[e]=t;var m=(s,e,t)=>g(s,typeof e!="symbol"?e+"":e,t);import{o as y}from"./aiProxyService-DC3Ox1Kq.js";import"./index-CRPOeG8q.js";import"./vendor-motion-_XdJ9pBm.js";import"./vendor-react-B4msnGgW.js";import"./vendor-pdf-B1igRwBP.js";import"./vendor-supabase-B_87WqdG.js";import"./vendor-forms-BxTF4-4_.js";const l=class l{async callAI(e,t,o=.7){return y.chatWithSystem(e,t,{model:l.JOB_WRITER_MODEL,temperature:o})}async polishJobDescription(e){const{companyName:t,roleTitle:o,domain:n,description:i,qualification:a,experienceRequired:r}=e,c="You are an expert HR content writer specializing in creating compelling job descriptions. Your task is to polish and enhance job descriptions to make them more attractive to candidates while maintaining accuracy and professionalism.",p=`Please polish and enhance the following job description. Make it more engaging, clear, and professional. Keep the core information accurate but improve the language, structure, and appeal.

Company: ${t}
Role: ${o}
Domain: ${n}
Experience Required: ${r||"Not specified"}
Qualification: ${a||"Not specified"}

Current Description:
${i}

Please provide an improved version that:
1. Has a compelling opening paragraph about the role
2. Clearly outlines key responsibilities
3. Lists required qualifications and skills
4. Highlights what makes this opportunity attractive
5. Uses professional yet approachable language
6. Is well-structured and easy to read

Improved Description:`;try{return await this.callAI(c,p,.7)}catch(d){throw console.error("Error polishing job description:",d),new Error("Failed to polish job description. Please try again later.")}}async generateCompanyDescription(e){const{companyName:t,roleTitle:o,domain:n,jobDescription:i,qualification:a,experienceRequired:r}=e,c="You are an expert at creating compelling company descriptions that help candidates understand what a company does and why they should apply.",p=`Create a brief, engaging company description (2-3 paragraphs, around 150-200 words) for:

Company Name: ${t}
They are hiring for: ${o} (${n})
Experience Level: ${r||"Not specified"}
Required Qualification: ${a||"Not specified"}
${i?`
Job Context:
${i.substring(0,500)}`:""}

Create a description that:
1. Explains what the company likely does based on the role and domain
2. Highlights why it's an exciting place to work
3. Mentions the kind of impact the candidate can make
4. Uses professional but friendly language
5. Is generic enough to fit most companies but specific to the role

Company Description:`;try{return await this.callAI(c,p,.8)}catch(d){return console.error("Error generating company description:",d),`${t} is a dynamic organization seeking talented professionals to join their team. This ${o} position offers an excellent opportunity to work with cutting-edge technologies and contribute to impactful projects. The ideal candidate will bring their expertise in ${n} to help drive innovation and success.`}}async extractKeywords(e,t){const o="You are an expert at analyzing job descriptions and extracting key technical skills, tools, and keywords that should be highlighted in a resume for ATS optimization.",n=`Extract the most important keywords, skills, and technologies from this job description for the role of ${t}. Focus on technical skills, tools, frameworks, methodologies, and domain-specific terms that would be important for ATS (Applicant Tracking Systems).

Job Description:
${e.substring(0,2e3)}

Provide a comma-separated list of 15-25 most important keywords:`;try{return(await this.callAI(o,n,.5)).split(",").map(r=>r.trim()).filter(r=>r.length>0&&r.length<50).slice(0,25)}catch(i){return console.error("Error extracting keywords:",i),[]}}async generateInterviewTips(e){const{roleTitle:t,domain:o,companyName:n,testTypes:i=[]}=e,a="You are a career coach helping candidates prepare for job interviews.",r=i.length>0?`The interview process includes: ${i.join(", ")}.`:"",c=`Provide 5-7 brief, actionable interview preparation tips for someone applying for:

Role: ${t}
Domain: ${o}
Company: ${n}
${r}

Focus on:
1. What to prepare technically
2. How to showcase relevant experience
3. Common interview topics for this domain
4. What the company might be looking for
5. How to stand out as a candidate

Keep tips concise (1-2 sentences each) and practical.

Interview Tips:`;try{return await this.callAI(a,c,.7)}catch(p){return console.error("Error generating interview tips:",p),`Prepare thoroughly for your ${t} interview by reviewing core ${o} concepts, practicing common technical questions, and being ready to discuss your relevant projects and experience. Research ${n} and prepare thoughtful questions about the role and team.`}}isConfigured(){return!0}};m(l,"JOB_WRITER_MODEL","stepfun/step-3.5-flash:free");let h=l;const P=new h;export{P as deepseekService};
