import{o as l}from"./aiProxyService-DzMwr7OW.js";import"./index-NlwF7PvK.js";import"./vendor-motion-_XdJ9pBm.js";import"./vendor-react-B4msnGgW.js";import"./vendor-pdf-B1igRwBP.js";import"./vendor-supabase-B_87WqdG.js";import"./vendor-forms-BxTF4-4_.js";class d{async callAI(r,e,t=.7){return l.chatWithSystem(r,e,{model:"google/gemini-2.5-flash",temperature:t})}async polishJobDescription(r){const{companyName:e,roleTitle:t,domain:n,description:o,qualification:a,experienceRequired:i}=r,s="You are an expert HR content writer specializing in creating compelling job descriptions. Your task is to polish and enhance job descriptions to make them more attractive to candidates while maintaining accuracy and professionalism.",c=`Please polish and enhance the following job description. Make it more engaging, clear, and professional. Keep the core information accurate but improve the language, structure, and appeal.

Company: ${e}
Role: ${t}
Domain: ${n}
Experience Required: ${i||"Not specified"}
Qualification: ${a||"Not specified"}

Current Description:
${o}

Please provide an improved version that:
1. Has a compelling opening paragraph about the role
2. Clearly outlines key responsibilities
3. Lists required qualifications and skills
4. Highlights what makes this opportunity attractive
5. Uses professional yet approachable language
6. Is well-structured and easy to read

Improved Description:`;try{return await this.callAI(s,c,.7)}catch(p){throw console.error("Error polishing job description:",p),new Error("Failed to polish job description. Please try again later.")}}async generateCompanyDescription(r){const{companyName:e,roleTitle:t,domain:n,jobDescription:o,qualification:a,experienceRequired:i}=r,s="You are an expert at creating compelling company descriptions that help candidates understand what a company does and why they should apply.",c=`Create a brief, engaging company description (2-3 paragraphs, around 150-200 words) for:

Company Name: ${e}
They are hiring for: ${t} (${n})
Experience Level: ${i||"Not specified"}
Required Qualification: ${a||"Not specified"}
${o?`
Job Context:
${o.substring(0,500)}`:""}

Create a description that:
1. Explains what the company likely does based on the role and domain
2. Highlights why it's an exciting place to work
3. Mentions the kind of impact the candidate can make
4. Uses professional but friendly language
5. Is generic enough to fit most companies but specific to the role

Company Description:`;try{return await this.callAI(s,c,.8)}catch(p){return console.error("Error generating company description:",p),`${e} is a dynamic organization seeking talented professionals to join their team. This ${t} position offers an excellent opportunity to work with cutting-edge technologies and contribute to impactful projects. The ideal candidate will bring their expertise in ${n} to help drive innovation and success.`}}async extractKeywords(r,e){const t="You are an expert at analyzing job descriptions and extracting key technical skills, tools, and keywords that should be highlighted in a resume for ATS optimization.",n=`Extract the most important keywords, skills, and technologies from this job description for the role of ${e}. Focus on technical skills, tools, frameworks, methodologies, and domain-specific terms that would be important for ATS (Applicant Tracking Systems).

Job Description:
${r.substring(0,2e3)}

Provide a comma-separated list of 15-25 most important keywords:`;try{return(await this.callAI(t,n,.5)).split(",").map(i=>i.trim()).filter(i=>i.length>0&&i.length<50).slice(0,25)}catch(o){return console.error("Error extracting keywords:",o),[]}}async generateInterviewTips(r){const{roleTitle:e,domain:t,companyName:n,testTypes:o=[]}=r,a="You are a career coach helping candidates prepare for job interviews.",i=o.length>0?`The interview process includes: ${o.join(", ")}.`:"",s=`Provide 5-7 brief, actionable interview preparation tips for someone applying for:

Role: ${e}
Domain: ${t}
Company: ${n}
${i}

Focus on:
1. What to prepare technically
2. How to showcase relevant experience
3. Common interview topics for this domain
4. What the company might be looking for
5. How to stand out as a candidate

Keep tips concise (1-2 sentences each) and practical.

Interview Tips:`;try{return await this.callAI(a,s,.7)}catch(c){return console.error("Error generating interview tips:",c),`Prepare thoroughly for your ${e} interview by reviewing core ${t} concepts, practicing common technical questions, and being ready to discuss your relevant projects and experience. Research ${n} and prepare thoughtful questions about the role and team.`}}isConfigured(){return!0}}const k=new d;export{k as deepseekService};
