import{D as ie,d as te,F as ne,B as re,e as se,g as oe,T as ae,P as le,h as ce}from"./skillsTaxonomy-KpHbAXEo.js";import{o as de}from"./aiProxyService-C4Nr5NiF.js";import{a5 as pe}from"./index-D92d5KDW.js";function H(c){let s=c.trim();return s=s.replace(/\s+v?\d+(\.\d+)?(\.\d+)?\.?x?\s*$/i,""),s=s.replace(/\s*\([^)]*\d+[^)]*\)/g,""),/^[A-Z]{2,}\d+$/.test(s)||(s=s.replace(/\s+\d+$/g,"")),s.trim()}function B(c){let s=c;return[{pattern:/Python\s+3\.\d+/gi,replacement:"Python"},{pattern:/Node\.js\s+\d+\.x/gi,replacement:"Node.js"},{pattern:/React\s+\d+/gi,replacement:"React"},{pattern:/Angular\s+\d+/gi,replacement:"Angular"},{pattern:/Vue\s+\d+/gi,replacement:"Vue.js"},{pattern:/TypeScript\s+\d+/gi,replacement:"TypeScript"},{pattern:/Java\s+\d+/gi,replacement:"Java"},{pattern:/Spring\s+Boot\s+\d+/gi,replacement:"Spring Boot"},{pattern:/Django\s+\d+/gi,replacement:"Django"},{pattern:/Flask\s+\d+/gi,replacement:"Flask"},{pattern:/NodeJS/gi,replacement:"Node.js"},{pattern:/ReactJS/gi,replacement:"React"},{pattern:/VueJS/gi,replacement:"Vue.js"},{pattern:/NextJS/gi,replacement:"Next.js"},{pattern:/ExpressJS/gi,replacement:"Express"}].forEach(({pattern:o,replacement:h})=>{s=s.replace(o,h)}),s}function Q(c){const s=new Map;return c.forEach(p=>{const o=H(p),h=o.toLowerCase();(!s.has(h)||o.length<s.get(h).length)&&s.set(h,o)}),Array.from(s.values())}console.log("GeminiService: Using OpenRouter AI via Supabase Edge Function proxy");const w=5e4,ue=3,me=1e3,M=pe,N=!1,x=c=>{const s=p=>{let o=p;return o=o.replace(/\/\*[\s\S]*?\*\//g,""),o=o.replace(/\/\/\s*Line\s*\d+\s*/g,""),o=o.split(/\r?\n/).map(d=>{if(/^\s*\/\//.test(d))return"";const T=d.indexOf("//");return T!==-1&&!d.slice(0,T).includes("://")?d.slice(0,T).trimEnd():d}).join(`
`),o=o.replace(/\n{3,}/g,`

`),o.trim()};if(typeof c=="string")return s(c);if(Array.isArray(c))return c.map(x);if(c&&typeof c=="object"){const p={};for(const o of Object.keys(c))p[o]=x(c[o]);return p}return c},W=async(c,s=ue)=>{let p=0,o=me;const h=c.model||M;for(;p<s;)try{const d=await de.chatWithSystem("You are a professional resume optimization assistant. Always respond with valid JSON only.",c.prompt,{model:h,temperature:.3});if(!d)throw new Error("No content returned from OpenRouter");return{content:d}}catch(d){if(d.message.includes("429")||d.message.includes("500")||d.message.includes("Failed to fetch")||d.message.includes("NetworkError")){if(p++,p>=s)throw new Error(`OpenRouter API error: Failed after ${s} retries. ${d.message}`);console.warn(`OpenRouter API error: ${d.message}. Retrying in ${o/1e3}s... (Attempt ${p}/${s})`),await new Promise(T=>setTimeout(T,o)),o*=2;continue}throw d}throw new Error(`Failed after ${s} retries`)},Se=async(c,s,p,o,h,d,T,A,L,E,g,t,a,O,R,b="standard")=>{var $,U,F,G,J,z,V,_,Y;console.log("═══════════════════════════════════════════════════════════"),console.log("🚀 RESUME OPTIMIZATION STARTED"),console.log("═══════════════════════════════════════════════════════════"),console.log("📝 Resume length:",c.length,"chars"),console.log("📋 JD length:",s.length,"chars"),console.log("👤 User type:",p),console.log("👤 User name:",o||"(not provided)");const j=B(c),D=B(s);if(console.log("✨ Applied version stripping to resume and JD"),j.length+D.length>w)throw new Error(`Input too long. Combined resume and job description exceed ${w} characters. Please shorten your input.`);const X=e=>e==="experienced"?`You are a professional resume optimization assistant for EXPERIENCED PROFESSIONALS. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

EXPERIENCED PROFESSIONAL REQUIREMENTS:
1. MUST include a compelling Professional Summary (2-3 lines highlighting key experience and value proposition)
2. PRIORITIZE Work Experience section - this should be the most prominent
3. Education section should be minimal or omitted unless specifically required by the job
4. Focus on quantifiable achievements and leadership experience
5. Emphasize career progression and increasing responsibilities

SECTION ORDER FOR EXPERIENCED PROFESSIONALS:
1. Contact Information
2. Professional Summary (REQUIRED)
3. Technical Skills
4. Professional Experience (MOST IMPORTANT)
5. Projects (if relevant to role)
6. Certifications
7. Education (minimal or omit if not required)
8. Additional Sections (if provided, with custom titles)`:e==="student"?`You are a professional resume optimization assistant for COLLEGE STUDENTS. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

COLLEGE STUDENT REQUIREMENTS:
1. MUST include a compelling Career Objective (2 lines, ATS-readable, focusing on learning goals and internship aspirations)
2. PRIORITIZE Education section - this should be prominent with CGPA and institution location
3. Focus on academic projects, coursework, and transferable skills
4. Include achievements, certifications, and extracurricular activities
5. Highlight learning ability, enthusiasm, and academic excellence
6. ALL INTERNSHIPS, TRAININGS, and WORK EXPERIENCE should be categorized under "workExperience" section
7. Extract CGPA from education if mentioned (e.g., "CGPA: 8.4/10" or "GPA: 3.8/4.0")
8. Include location in contact information and education details

SECTION ORDER FOR COLLEGE STUDENTS:
1. Contact Information (including location)
2. Career Objective (REQUIRED - 2 lines focusing on internship goals)
3. Education (PROMINENT - with CGPA and location)
4. Technical Skills
5. Academic Projects (IMPORTANT)
6. Internships & Work Experience (if any)
7. Certifications
8. Additional Sections (if provided, with custom titles)`:`You are a professional resume optimization assistant for FRESHERS/NEW GRADUATES. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

FRESHER REQUIREMENTS:
1. MUST include a compelling Career Objective (2 lines MAX, ATS-readable, focusing on entry-level goals, relevant skills, and aspirations)
2. CRITICAL: DO NOT include any years of experience in the career objective (e.g., "1 year experience", "2 years of experience", "X+ years"). Freshers have NO professional experience - focus on skills, education, and eagerness to learn.
3. PRIORITIZE Education, Academic Projects, and Internships
4. Include additional sections that showcase potential: Achievements, Extra-curricular Activities, Languages
5. Focus on academic projects, internships, and transferable skills
6. Highlight learning ability, enthusiasm, and relevant coursework
7. ALL INTERNSHIPS, TRAININGS, and WORK EXPERIENCE should be categorized under "workExperience" section
8. Extract CGPA from education if mentioned (e.g., "CGPA: 8.4/10")

CAREER OBJECTIVE FOR FRESHERS - CRITICAL RULES:
- NEVER mention "X years of experience" or any experience duration
- Focus on: skills learned, technologies known, career goals, eagerness to contribute
- Example GOOD: "Motivated Computer Science graduate seeking entry-level software developer role to apply React and Node.js skills in building scalable applications."
- Example BAD: "Software developer with 1 year experience seeking..." (WRONG - freshers don't have years of experience)

SECTION ORDER FOR FRESHERS:
1. Contact Information
2. Career Objective (REQUIRED - 2 lines focusing on entry-level goals, NO experience years)
3. Technical Skills
4. Education (PROMINENT)
5. Internships & Work Experience (IMPORTANT - includes all internships, trainings, and work)
6. Academic Projects (IMPORTANT)
7. Certifications
8. Additional Sections (if provided, with custom titles)`,K={light:`HIGHEST PRIORITY — QUICK BASIC REWRITE MODE:
- Rewrite the full resume once for clearer ATS readability and stronger alignment with the supplied job description.
- Improve the professional summary or objective, experience bullets, project bullets, skills organization, and section wording at a basic level.
- Preserve every candidate fact, employer, date, credential, technology, project, and metric from the source resume.
- Never add a JD skill, qualification, project, achievement, or metric unless the original resume explicitly supports it.
- Keep unsupported JD requirements as gaps; do not turn them into candidate claims.
- Return the complete rewritten resume in the required JSON schema.`,standard:`SMART OPTIMIZE MODE:
- Improve summary, experience, projects, section clarity, and JD alignment.
- Use only facts supported by the supplied resume. Never invent skills, employers, metrics, dates, or achievements.`,aggressive:`DEEP OPTIMIZE MODE:
- Perform the deepest evidence-constrained rewrite and role alignment.
- Use only facts supported by the supplied resume. Never invent skills, employers, metrics, dates, or achievements.
- Prefer explicit user-action suggestions over adding any unsupported claim.`},q=`${X(p)}

${K[b]}

CRITICAL REQUIREMENTS FOR BULLET POINTS:
1. Each bullet point MUST be concise, containing maximum 10 words only.
2. Include relevant keywords from the job description across all bullet points.
3. Use STRONG ACTION VERBS only (no weak verbs like "helped", "assisted", "worked on", "was responsible for", "participated in", "involved in", "contributed to")
4. Start each bullet with powerful verbs like: Developed, Implemented, Architected, Optimized, Engineered, Designed, Led, Managed, Created, Built, Delivered, Achieved, Increased, Reduced, Streamlined, Automated, Transformed, Executed, Spearheaded, Established
5. Ensure no word is repeated more than twice across all bullet points within a section.

METRIC RULES - REALISTIC AND SPARSE (CRITICAL):
6. NOT every bullet needs a metric. Use metrics SPARINGLY and REALISTICALLY:
   - Maximum 1-2 bullets with metrics PER work experience entry (out of 3 bullets)
   - Maximum 1 bullet with a metric PER project entry (out of 2-3 bullets)
   - The remaining bullets should describe WHAT was built/done with SPECIFIC technical details
7. If original resume has metrics, PRESERVE them exactly (40%, $1M, 10,000+ users).
8. NEVER generate exaggerated or unrealistic metrics:
   - NEVER claim "99.9% uptime" unless the person was a lead/principal engineer on infra
   - NEVER claim "10,000+ users" for intern or junior-level projects
   - NEVER use vague filler phrases like "enhancing overall outcomes" or "optimizing overall performance"
   - Interns: max "500 users", "15% improvement", "3 team members"
   - Junior devs: max "2,000 users", "25% improvement", "5 team members"
   - Mid-level: max "10,000 users", "40% improvement"
   - Senior: use realistic enterprise-scale numbers
9. Metrics should be SPECIFIC, not generic. NEVER use these patterns:
   - "successfully enhancing overall outcomes" (too vague)
   - "effectively optimizing overall performance" (too vague)
   - "significantly reducing overall costs" (too vague)
   - Any phrase with "overall" + generic noun is BANNED
10. GOOD metric bullets: "Reduced API latency from 800ms to 200ms" or "Processed 500 daily orders using Kafka"
11. GOOD non-metric bullets: "Built authentication module using JWT and OAuth2" or "Designed normalized database schema with 15 tables"

12. Focus on SPECIFIC technical details, not generic impact claims.
13. MANDATORY: Each work experience entry MUST have EXACTLY 3 bullet points.
14. MANDATORY: Each project entry MUST have EXACTLY 2-3 bullet points.
15. All section titles MUST be in ALL CAPS.
16. Dates should use the exact format "Jan 2023 - Mar 2024".
17. Integrate keywords naturally and contextually, avoiding keyword stuffing.
18. Improve keyword alignment only with skills and experience already evidenced in the original resume.
19. NEVER use subjective adjectives like "passionate", "dedicated", "hardworking", "dynamic", "results-driven".
20. If the user provides minimal information, preserve it and flag the gap; do not add technical details.

BANNED PHRASES (NEVER USE THESE):
- "successfully enhancing overall outcomes"
- "effectively optimizing overall performance"
- "significantly reducing overall costs"
- "dramatically improving overall efficiency"
- Any variation of "[adverb] + [verb]ing + overall + [noun]"
- "resulting in enhanced productivity"
- "ensuring seamless integration"
- "fostering collaborative environment"
- "leveraging cutting-edge technologies"
- "driving innovation across"

METRIC PRESERVATION RULES (CRITICAL - DO NOT VIOLATE):
1. PRESERVE ALL NUMERIC METRICS from the original resume EXACTLY as they appear
2. DO NOT change, round, or approximate any numbers
3. If you cannot naturally integrate a metric while rewriting, keep the original phrasing
4. NEVER remove impact metrics to make room for keywords

CONTEXTUAL KEYWORD INSERTION RULES:
1. Maximum 2 job description keywords per bullet point
2. Only insert keywords where they fit the SEMANTIC CONTEXT of the original bullet
3. Do NOT insert keywords at the start of bullets
4. If semantic context doesn't match, DO NOT force keyword insertion

WORD VARIETY - NO REPETITION (CRITICAL):
1. NEVER use the same action verb to start more than 2 bullets across the ENTIRE resume
2. NEVER repeat the same word more than 3 times across all bullets
3. NEVER use the same sentence structure pattern for consecutive bullets
4. Each bullet MUST feel distinct in both vocabulary and structure

HALLUCINATION PREVENTION:
1. ONLY use candidate technologies and skills explicitly supported by the original resume.
2. A technology mentioned only in the job description is missing evidence and MUST NOT be added.
3. DO NOT invent project names, projects, company names, credentials, dates, metrics, achievements, or technical terms.
4. Stick to facts from the original resume - enhance presentation, not content.

PROJECT STRUCTURING REQUIREMENTS:
1. Project Title (e.g., "E-commerce Platform")
2. 2-3 impact bullets with VERB + TECH + specific detail pattern
3. Only 1 bullet per project should have a metric; others describe technical specifics

CERTIFICATION EXPANSION REQUIREMENTS:
1. Expand ALL abbreviated certification names to full official titles
2. Include certification provider in the title

JOB TITLE PLACEMENT REQUIREMENTS:
1. The targetRole field may use the requested JD title because it describes the application target.
2. Do not change any past or current role title to match the JD.

KEYWORD FREQUENCY REQUIREMENTS:
1. Extract top 5-10 technical skills from the job description
2. Distribute keywords across different sections naturally
3. Ensure keywords fit semantic context of each bullet

WORD COUNT REQUIREMENTS (STRICT):
1. Professional Summary: 40-60 words
2. Each bullet point: maximum 10 words
3. Total resume target: 400-650 words
4. DO NOT exceed these limits

SKILLS REQUIREMENTS:
1. Include 4-6 distinct TECHNICAL skill categories only
2. Each category should contain 5-8 specific, relevant skills
3. NEVER include version numbers (Python, not Python 3.11; React, not React 18)
4. DO NOT include a "Soft Skills" category - only technical skills
5. Match skills to job requirements and industry standards

CERTIFICATIONS REQUIREMENTS (CRITICAL):
1. For EACH certification, provide a concise 15-word description in the 'description' field
2. Description MUST explain what the certification validates or demonstrates
3. Example format:
   - title: "AWS Certified Solutions Architect - Associate"
   - description: "Validates expertise in designing distributed systems and deploying applications on AWS cloud infrastructure."
4. NEVER leave description empty or as "..."

SOCIAL LINKS REQUIREMENTS - CRITICAL:
1. LinkedIn URL: "${E||""}" - ONLY include if this is NOT empty
2. GitHub URL: "${g||""}" - ONLY include if this is NOT empty
3. If LinkedIn URL is empty (""), set linkedin field to empty string ""
4. If GitHub URL is empty (""), set github field to empty string ""
5. DO NOT create, modify, or generate any social media links
6. Use EXACTLY what is provided - no modifications

TARGET ROLE INFORMATION:
${t?`Target Role: "${t}"`:"No specific target role provided"}

CONDITIONAL SECTION GENERATION: (Ensure these sections are generated based on user type)
${p==="experienced"?`
- Professional Summary: REQUIRED - Create a compelling 2-3 line summary
- Education: MINIMAL or OMIT unless specifically required by job
- Focus heavily on work experience and achievements
- Omit or minimize fresher-specific sections
`:p==="student"?`
- Career Objective: REQUIRED - Create a compelling 2-line objective focusing on internship goals
- Education: PROMINENT - include degree, institution, year, CGPA, and location
- Academic Projects: IMPORTANT - treat as main experience section
- Work Experience: Include any internships, part-time jobs, or training
- Achievements: Include academic awards, competitions, rankings
- Languages Known: Include if present (list languages with proficiency levels if available)
- Location: Include in contact information and education details
`:`
- Professional Summary: OPTIONAL - only if candidate has relevant internships/experience
- Career Objective: REQUIRED - Create a compelling 2-line objective focusing on entry-level goals. CRITICAL: DO NOT include any "X years of experience" - freshers have no professional experience years.
- Education: INCLUDE CGPA if mentioned in original resume (e.g., "CGPA: 8.4/10") and date format ex;2021-2024 
- Academic Projects: IMPORTANT - treat as main experience section
- Work Experience: COMBINE all internships, trainings, and work experience under this single section
- Certifications
- Achievements: Include if present in original resume (academic awards, competitions, etc.)
- Extra-curricular Activities: Include if present (leadership roles, clubs, volunteer work)
- Languages Known: Include if present (list languages with proficiency levels if available)
- Personal Details (if present in original resume)`}

IMPORTANT: Follow the exact structure provided below. Only include sections that have actual content.

Rules:
1. Only respond with valid JSON
2. Use the exact structure provided below
3. Rewrite bullet points following the CRITICAL REQUIREMENTS above
4. Reorder and categorize only the skills already supported by the original resume
5. Only include sections that have meaningful content
6. If optional sections don't exist in original resume, set them as empty arrays or omit
7. Ensure all dates are in proper format (e.g., "Jan 2023 – Mar 2024")
8. Use professional language and industry-specific keywords from the job description
9. For LinkedIn and GitHub, use EXACTLY what is provided - empty string if not provided
10. The "name" field in the JSON should ONLY contain the user's name. The "email", "phone", "linkedin", "github", and "location" fields MUST NOT contain the user's name or any part of it. The user's name should appear ONLY in the dedicated "name" field.
11. Include only projects present in the original resume. If none exist, return an empty projects array.
12. Never create a project or project detail from the job description.
11. NEW: If 'additionalSections' are provided, include them in the output JSON with their custom titles and optimized bullet points. Apply all bullet point optimization rules to these sections as well.

JSON Structure:
{
  "name": "${o||"..."}",
  "location": "...", 
  "phone": "${T||"..."}",
  "email": "${d||"..."}",
  "linkedin": "${A||E||"..."}",
  "github": "${L||g||"..."}",
  "targetRole": "${t||"..."}",
  ${p==="experienced"?'"summary": "...",':""}
  ${p==="student"?'"careerObjective": "...",':""}
  ${p==="fresher"?'"careerObjective": "...",':""}
  "education": [
    {"degree": "...", "school": "...", "year": "...", "cgpa": "...", "location": "..."}
  ],
  "workExperience": [
    {"role": "...", "company": "...", "year": "...", "bullets": ["...", "...", "..."]}
  ],
  "projects": [
    {"title": "...", "bullets": ["...", "...", "..."]}
  ],
  "skills": [
    {"category": "Programming Languages", "count": 6, "list": ["JavaScript", "TypeScript", "Python", "Java", "SQL", "Go"]},
    {"category": "Frontend Technologies", "count": 6, "list": ["React", "Angular", "Vue.js", "HTML5", "CSS3", "Tailwind CSS"]},
    {"category": "Backend Technologies", "count": 5, "list": ["Node.js", "Express", "Django", "Spring Boot", "GraphQL"]},
    {"category": "Databases", "count": 5, "list": ["PostgreSQL", "MongoDB", "Redis", "MySQL", "DynamoDB"]},
    {"category": "Cloud & DevOps", "count": 6, "list": ["AWS", "Docker", "Kubernetes", "Jenkins", "CI/CD", "Terraform"]},
    {"category": "Data Science & ML", "count": 5, "list": ["TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn"]},
    {"category": "Tools & Platforms", "count": 5, "list": ["Git", "GitHub", "Jira", "Postman", "VS Code"]},
    {"category": "Testing & QA", "count": 4, "list": ["Jest", "Pytest", "Selenium", "Cypress"]},
    {"category": "Soft Skills", "count": 5, "list": ["Leadership", "Communication", "Problem-solving", "Teamwork", "Agile"]}
  ],

CRITICAL SKILL CATEGORIZATION RULES - YOU MUST FOLLOW THESE EXACTLY:
1. Programming Languages: ONLY actual programming languages (JavaScript, TypeScript, Python, Java, C++, Go, etc.)
   - DO NOT include: HTML, CSS, React, Angular, Vue, Express, Docker, Kubernetes, AWS, Azure, TensorFlow
2. Frontend Technologies: React, Angular, Vue.js, HTML5, CSS3, Tailwind, Bootstrap, Next.js, etc.
3. Backend Technologies: Node.js, Express, Django, Flask, Spring Boot, FastAPI, etc.
4. Databases: MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch, etc.
5. Cloud & DevOps: AWS, Azure, Docker, Kubernetes, Terraform, Jenkins, CI/CD, etc.
6. Data Science & ML: TensorFlow, PyTorch, Keras, Pandas, NumPy, Scikit-learn, Jupyter, Spark, etc.
7. Tools & Platforms: Git, GitHub, Jira, VS Code, Postman, etc.
8. Testing & QA: Jest, Pytest, Selenium, Cypress, JUnit, Mocha, etc.
9. Soft Skills: Leadership, Communication, Teamwork, Problem-solving, etc.

CRITICAL: REMOVE VERSION NUMBERS FROM ALL SKILLS:
- "Python 3.11" → "Python"
- "React 18" → "React"
- "Node.js 20" → "Node.js"
- "Java 11" → "Java"

EXAMPLES OF CORRECT CATEGORIZATION:
- JavaScript, Python, Java → Programming Languages
- React, Angular, Vue.js, Next.js → Frontend Technologies
- Express, Django, Spring Boot → Backend Technologies
- Docker, Kubernetes, AWS, Terraform → Cloud & DevOps
- TensorFlow, PyTorch, Pandas → Data Science & ML
- MySQL, MongoDB, PostgreSQL → Databases
- Git, GitHub, Jira, VS Code → Tools & Platforms
- Jest, Pytest, Selenium → Testing & QA
  "certifications": [
    {"title": "AWS Certified Solutions Architect", "description": "Validates expertise in designing distributed systems on AWS cloud infrastructure."},
    {"title": "Google Cloud Professional", "description": "Demonstrates proficiency in deploying and managing applications on Google Cloud Platform."}
  ],
  
  
  
}
Resume:
${j}

Job Description:
${D}

User Type: ${p.toUpperCase()}

LinkedIn URL provided: ${E||"NONE - leave empty"}
GitHub URL provided: ${g||"NONE - leave empty"}
`;let k=(await W({prompt:q,model:R||M})).content;if(!k)throw new Error("No content returned from EdenAI");const C=k.match(/```json\s*([\s\S]*?)\s*```/);let v;C&&C[1]?v=C[1].trim():v=k.replace(/```json/g,"").replace(/```/g,"").trim();try{let e=JSON.parse(v);e=x(e);const Z=/^(?:n\/a|not\s*specified|none)$/i,P=i=>{if(typeof i=="string"){const r=i.trim();return Z.test(r)?"":r}if(Array.isArray(i))return i.map(P);if(i&&typeof i=="object"){const r={};for(const y of Object.keys(i))r[y]=P(i[y]);return r}return i};if(e=P(e),e.skills&&Array.isArray(e.skills)){console.log("🛠️ Processing skills..."),console.log("   - Raw skills from AI:",JSON.stringify(e.skills));const i={"Programming Languages":[],"Frontend Technologies":[],"Backend Technologies":[],Databases:[],"Cloud & DevOps":[],"Data Science & ML":[],"Testing & QA":[],"Tools & Platforms":[]},r=n=>Array.isArray(n)?n.filter(f=>typeof f=="string"):n&&n.list&&Array.isArray(n.list)?n.list.filter(f=>typeof f=="string"):n&&n.skills&&Array.isArray(n.skills)?n.skills.filter(f=>typeof f=="string"):typeof n=="string"?n.split(",").map(f=>f.trim()).filter(Boolean):[];e.skills.forEach(n=>{r(n).forEach(I=>{if(!I||typeof I!="string")return;const u=H(I),m=u.toLowerCase().trim();if(m){if(ie.some(l=>m===l||m.includes(l))){i["Data Science & ML"].includes(u)||i["Data Science & ML"].push(u);return}if(!te.some(l=>m.includes(l))){if(ne.some(l=>m===l||m.includes(l))){i["Frontend Technologies"].includes(u)||i["Frontend Technologies"].push(u);return}if(re.some(l=>m===l||m.includes(l))){i["Backend Technologies"].includes(u)||i["Backend Technologies"].push(u);return}if(se.some(l=>m===l||m.includes(l))){i["Cloud & DevOps"].includes(u)||i["Cloud & DevOps"].push(u);return}if(oe.some(l=>m===l||m.includes(l))){i.Databases.includes(u)||i.Databases.push(u);return}if(ae.some(l=>m===l||m.includes(l))){i["Testing & QA"].includes(u)||i["Testing & QA"].push(u);return}if(le.some(l=>m===l||m.includes(l))){i["Programming Languages"].includes(u)||i["Programming Languages"].push(u);return}if(ce.some(l=>m===l||m.includes(l))){i["Tools & Platforms"].includes(u)||i["Tools & Platforms"].push(u);return}i["Tools & Platforms"].includes(u)||i["Tools & Platforms"].push(u)}}})});const y=["Programming Languages","Frontend Technologies","Backend Technologies","Databases","Cloud & DevOps","Data Science & ML","Testing & QA","Tools & Platforms"];e.skills=y.filter(n=>i[n].length>0).map(n=>({category:n,count:Q(i[n]).length,list:Q(i[n])})),console.log("   - Reorganized skills:",e.skills.map(n=>`${n.category}: ${n.count}`)),e.skills.length<3&&console.log("   ⚠️ Too few skill categories after reorganization, may need to check AI response format")}if(e.certifications&&Array.isArray(e.certifications)){const i={aws:"Validates expertise in designing and deploying scalable systems on Amazon Web Services.",azure:"Demonstrates proficiency in Microsoft Azure cloud services and solutions architecture.",gcp:"Certifies knowledge of Google Cloud Platform infrastructure and application development.",kubernetes:"Validates skills in deploying, managing, and scaling containerized applications.",docker:"Demonstrates expertise in containerization and Docker ecosystem technologies.",pmp:"Certifies project management expertise following PMI standards and best practices.",scrum:"Validates understanding of Scrum framework and agile project management methodologies.",cissp:"Demonstrates advanced knowledge in information security and cybersecurity practices.",comptia:"Validates foundational IT skills and technical knowledge for IT professionals.",oracle:"Certifies expertise in Oracle database administration and development.",salesforce:"Demonstrates proficiency in Salesforce CRM platform and ecosystem.",terraform:"Validates infrastructure as code skills using HashiCorp Terraform."};e.certifications=e.certifications.map(r=>{if(typeof r=="string"){const y=r.toLowerCase();let n="";for(const[f,I]of Object.entries(i))if(y.includes(f)){n=I;break}return{title:r.trim(),description:n}}if(r&&typeof r=="object"){const y=typeof r.title=="string"&&r.title||typeof r.name=="string"&&r.name||typeof r.certificate=="string"&&r.certificate||typeof r.issuer=="string"&&r.issuer||typeof r.provider=="string"&&r.provider||"";let n=typeof r.description=="string"&&r.description||"";if(!n||n==="..."||n.length<10){const f=y.toLowerCase();for(const[I,u]of Object.entries(i))if(f.includes(I)){n=u;break}(!n||n.length<10)&&(n=`Professional certification validating expertise in ${y.split(" ").slice(0,3).join(" ")}.`)}return y?{title:y.trim(),description:n.trim()}:null}return{title:String(r),description:"Professional certification demonstrating technical expertise."}}).filter(Boolean)}N&&e.workExperience&&Array.isArray(e.workExperience),N&&e.projects&&Array.isArray(e.projects),console.log("📊 Post-processing: Ensuring all bullets have quantified metrics...");const he=/\d+%|\$\d+|\d+\s*(users?|customers?|clients?|team|people|million|k\b|x\b|hours?|days?|weeks?|months?|engineers?|developers?|projects?|apis?|requests?|transactions?)/i,fe=[", improving efficiency by 35%",", reducing processing time by 40%",", achieving 95% accuracy",", serving 1,000+ users",", with 99.9% uptime",", increasing performance by 30%",", reducing errors by 50%",", handling 5,000+ daily requests",", cutting development time by 25%",", improving user engagement by 45%"];let ee=0;if(N&&e.workExperience&&Array.isArray(e.workExperience),N&&e.projects&&Array.isArray(e.projects),console.log(`   ✅ Added metrics to ${ee} bullets`),e.additionalSections&&Array.isArray(e.additionalSections)&&(e.additionalSections=e.additionalSections.filter(i=>i&&i.title&&i.bullets&&i.bullets.length>0)),e.name=o||e.name||"",e.linkedin=A||e.linkedin||"",e.github=L||e.github||"",d)e.email=d;else if(e.email){const i=/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,r=String(e.email).match(i);e.email=r&&r[0]?r[0]:""}else e.email="";if(T)e.phone=T;else if(e.phone){const i=/(\+?\d{1,3}[-.\s]?)(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/,r=String(e.phone).match(i);e.phone=r&&r[0]?r[0]:""}else e.phone="";e.summary=String(e.summary||""),e.careerObjective=String(e.careerObjective||""),e.origin="jd_optimized",console.log("═══════════════════════════════════════════════════════════"),console.log("✅ RESUME OPTIMIZATION COMPLETED"),console.log("═══════════════════════════════════════════════════════════"),console.log("👤 Name:",e.name||"(missing)"),console.log("📧 Email:",e.email||"(missing)"),console.log("📱 Phone:",e.phone||"(missing)"),console.log("🔗 LinkedIn:",e.linkedin||"(missing)"),console.log("🐙 GitHub:",e.github||"(missing)"),console.log("📍 Location:",e.location||"(missing)"),console.log("🎯 Target Role:",e.targetRole||"(missing)"),console.log("📝 Summary:",e.summary?`${e.summary.slice(0,50)}...`:"(missing)"),console.log("🎓 Education entries:",(($=e.education)==null?void 0:$.length)||0),console.log("💼 Work experience entries:",((U=e.workExperience)==null?void 0:U.length)||0),console.log("🚀 Projects:",((F=e.projects)==null?void 0:F.length)||0),console.log("🛠️ Skill categories:",((G=e.skills)==null?void 0:G.length)||0),console.log("📜 Certifications:",((J=e.certifications)==null?void 0:J.length)||0);const S=[];return e.name||S.push("Name"),e.email||S.push("Email"),e.phone||S.push("Phone"),!e.summary&&!e.careerObjective&&S.push("Summary/Objective"),(z=e.education)!=null&&z.length||S.push("Education"),(V=e.workExperience)!=null&&V.length||S.push("Work Experience"),(_=e.projects)!=null&&_.length||S.push("Projects"),(Y=e.skills)!=null&&Y.length||S.push("Skills"),S.length>0?(console.warn("⚠️ MISSING SECTIONS:",S.join(", ")),(!e.projects||e.projects.length===0)&&(console.log("📝 Adding placeholder for projects section - will be populated from original resume"),e.projects=[]),(!e.skills||e.skills.length===0)&&(console.log("📝 Adding placeholder for skills section - will be populated from original resume"),e.skills=[])):console.log("✅ All sections populated"),console.log("═══════════════════════════════════════════════════════════"),e}catch(e){throw console.error("JSON parsing error:",e),console.error("Raw response attempted to parse:",v),new Error("Invalid JSON response from EdenAI")}},Re=async(c,s,p,o=3,h)=>{const d=JSON.stringify(s).length+((h==null?void 0:h.length)||0);if(d>w)throw new Error(`Input for variations too long (${d} characters). The maximum allowed is ${w} characters. Please shorten your input.`);const A=((g,t,a,O)=>{const R=`
CRITICAL ATS OPTIMIZATION RULES:
1. Use strong action verbs and industry keywords
2. Focus on quantifiable achievements and impact
3. Keep content concise
4. Avoid personal pronouns ("I", "my")
`;if(O)switch(g){case"summary":return`You are an expert resume writer specializing in ATS optimization for experienced professionals.
Generate ${a} distinctly different polished professional summary variations based on the following draft:
Draft: "${O}"
${R}
Each summary should be 2-3 sentences (50-80 words max).
Return ONLY a JSON array with exactly ${a} variations: ["summary1", "summary2", "summary3"]`;case"careerObjective":return`You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
Generate ${a} distinctly different polished career objective variations based on the following draft:
Draft: "${O}"
${R}
Each objective should be 2 sentences (30-50 words max) and have a different approach:
- Variation 1: Learning and growth-focused
- Variation 2: Skills and contribution-focused
- Variation 3: Career goals and enthusiasm-focused
Return ONLY a JSON array with exactly ${a} variations: ["objective1", "objective2", "objective3"]`}switch(g){case"summary":return`You are an expert resume writer specializing in ATS optimization for experienced professionals.
Generate ${a} distinctly different professional summary variations based on:
- User Type: ${t.userType}
- Target Role: ${t.targetRole||"General Professional Role"}
- Experience: ${JSON.stringify(t.experience||[])}
${R}
Each summary should be 2-3 sentences (50-80 words max) and have a different focus:
- Variation 1: Achievement-focused with metrics
- Variation 2: Skills and expertise-focused
- Variation 3: Leadership and impact-focused
Return ONLY a JSON array with exactly ${a} variations: ["summary1", "summary2", "summary3"]`;case"careerObjective":return`You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
Generate ${a} distinctly different career objective variations based on:
- User Type: ${t.userType}
- Target Role: ${t.targetRole||"Entry-level Professional Position"}
- Education: ${JSON.stringify(t.education||[])}
${R}
Each objective should be 2 sentences (30-50 words max) and have a different approach:
- Variation 1: Learning and growth-focused
- Variation 2: Skills and contribution-focused
- Variation 3: Career goals and enthusiasm-focused
Return ONLY a JSON array with exactly ${a} variations: ["objective1", "objective2", "objective3"]`;case"workExperienceBullets":return`You are an expert resume writer specializing in ATS optimization.
The following are DRAFT bullet points provided by the user for a work experience entry. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided role, company, and duration context.

DRAFT BULLET POINTS TO POLISH:
${t.description}

CONTEXT:
- Role: ${t.role}
- Company: ${t.company}
- Duration: ${t.year}
- User Type: ${t.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be concise with maximum 10 words.
2. Start each bullet with STRONG ACTION VERBS (Developed, Implemented, Led, Managed, Optimized, Achieved, Increased, Reduced)
3. NO weak verbs (helped, assisted, worked on, responsible for)
4. Include quantifiable achievements and metrics
5. Use industry-standard keywords
6. Focus on impact and results, not just responsibilities
7. Avoid repetitive words across bullets
8. Make each bullet distinct and valuable

Generate exactly ${a} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;case"projectBullets":return`You are an expert resume writer specializing in ATS optimization.
The following are DRAFT bullet points provided by the user for a project entry. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided project title, tech stack, and user type context.

DRAFT BULLET POINTS TO POLISH:
${t.description}

CONTEXT:
- Project Title: ${t.title}
- Tech Stack: ${t.techStack||"Modern technologies"}
- User Type: ${t.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be concise with maximum 10 words.
2. Start with STRONG ACTION VERBS (Developed, Built, Implemented, Designed, Created, Architected)
3. Include specific technologies mentioned in tech stack
4. Focus on technical achievements and impact
5. Include quantifiable results where possible
6. Use industry-standard technical keywords
7. Highlight problem-solving and innovation
8. Make each bullet showcase different aspects

Generate exactly ${a} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;case"additionalSectionBullets":return`You are an expert resume writer specializing in ATS optimization.

The following are DRAFT bullet points provided by the user for a custom section. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided section title and user type context.

DRAFT BULLET POINTS TO POLISH:
${t.details}

CONTEXT:
- Section Title: ${t.title}
- User Type: ${t.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be concise with maximum 10 words.
2. Start with STRONG ACTION VERBS (e.g., Awarded, Recognized, Achieved, Led, Volunteered, Fluent in)
3. Focus on achievements, contributions, or relevant details for the section type
4. Use industry-standard keywords where applicable
5. Quantify results where possible
6. Avoid repetitive words across bullets
7. Make each bullet distinct and valuable

Generate exactly ${a} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;case"certifications":return`You are an expert resume writer specializing in ATS optimization.

Given the following certification details and context:
- Current Certification Title: "${t.currentCertTitle||"Not provided"}"
- Current Certification Description: "${t.currentCertDescription||"Not provided"}"
- Target Role: ${t.targetRole||"Professional Role"}
- Current Skills: ${JSON.stringify(t.skills||[])}
- Job Description Context: ${t.jobDescription||"General professional context"}

Your task is to generate ${a} distinctly different polished and ATS-friendly titles for this certification.
Each title should be concise, professional, and highlight the most relevant aspect of the certification for a resume.
If the provided title/description is generic, make the generated titles more impactful and specific.

Return ONLY a JSON array with exactly ${a} polished certification titles: ["Polished Title 1", "Polished Title 2", "Polished Title 3"]`;case"achievements":return`You are an expert resume writer specializing in ATS optimization.

Generate ${a} different achievement variations based on:
- User Type: ${t.userType}
- Experience Level: ${t.experienceLevel||"Professional"}
- Target Role: ${t.targetRole||"Professional Role"}
- Context: ${t.context||"General professional achievements"}

${R}

Each achievement MUST be 2 lines and between 15-20 words.
Each variation should include 3-4 quantified achievements:
- Variation 1: Performance and results-focused
- Variation 2: Leadership and team impact-focused
- Variation 3: Innovation and process improvement-focused

Return ONLY a JSON array with exactly ${a} achievement lists: [["achievement1", "achievement2"], ["achievement3", "achievement4"], ["achievement5", "achievement6"]]`;case"skillsList":let b=`You are an expert resume writer specializing in ATS optimization.

Given the following skill category and existing skills:
- Category: ${t.category}
- Existing Skills (DRAFT): ${t.existingSkills||"None"}
- User Type: ${t.userType}
- Job Description: ${t.jobDescription||"None"}

CRITICAL REQUIREMENTS:
1. Provide 5-8 specific and relevant skills for the given category.
2. Prioritize skills mentioned in the job description or commonly associated with the user type and category.
3. Ensure skills are ATS-friendly.

`;return t.category==="Databases"&&(b+=`
IMPORTANT: For the 'Databases' category, the suggestions MUST be database languages (e.g., SQL, T-SQL, PL/SQL, MySQL, PostgreSQL, MongoDB, Oracle, Cassandra, Redis, DynamoDB, Firebase, Supabase), not theoretical topics like normalization, indexing, or database design principles. Focus on specific technologies and query languages.
`),b+=`
Return ONLY a JSON array of strings: ["skill1", "skill2", "skill3", "skill4", "skill5"]`,b;default:return`Generate ${a} ATS-optimized variations for ${g}.`}})(c,s,o,h);let E=(await W({prompt:A,model:M})).content;if(!E)throw new Error("No response content from EdenAI");E=E.replace(/```json/g,"").replace(/```/g,"").trim();try{const g=JSON.parse(E);return Array.isArray(g)&&!g.every(Array.isArray)?g.map(t=>[t]):Array.isArray(g)&&g.every(Array.isArray)?g.slice(0,o):[E.split(`
`).map(a=>a.replace(/^[•\-\*]\s*/,"").trim()).filter(a=>a.length>0).slice(0,o)]}catch(g){return console.error(`JSON parsing error for ${c}:`,g),console.error("Raw response that failed to parse:",E),[E.split(`
`).map(a=>a.replace(/^[•\-\*]\s*/,"").trim()).filter(a=>a.length>0).slice(0,o)]}};export{Re as g,Se as o};
