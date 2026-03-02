import{D as Z,S as ee,F as ie,B as te,b as ne,c as se,T as re,P as oe,d as ae}from"./skillsTaxonomy-D51GT-zQ.js";import{o as le}from"./aiProxyService-DzMwr7OW.js";function H(d){let r=d.trim();return r=r.replace(/\s+v?\d+(\.\d+)?(\.\d+)?\.?x?\s*$/i,""),r=r.replace(/\s*\([^)]*\d+[^)]*\)/g,""),/^[A-Z]{2,}\d+$/.test(r)||(r=r.replace(/\s+\d+$/g,"")),r.trim()}function Y(d){let r=d;return[{pattern:/Python\s+3\.\d+/gi,replacement:"Python"},{pattern:/Node\.js\s+\d+\.x/gi,replacement:"Node.js"},{pattern:/React\s+\d+/gi,replacement:"React"},{pattern:/Angular\s+\d+/gi,replacement:"Angular"},{pattern:/Vue\s+\d+/gi,replacement:"Vue.js"},{pattern:/TypeScript\s+\d+/gi,replacement:"TypeScript"},{pattern:/Java\s+\d+/gi,replacement:"Java"},{pattern:/Spring\s+Boot\s+\d+/gi,replacement:"Spring Boot"},{pattern:/Django\s+\d+/gi,replacement:"Django"},{pattern:/Flask\s+\d+/gi,replacement:"Flask"},{pattern:/NodeJS/gi,replacement:"Node.js"},{pattern:/ReactJS/gi,replacement:"React"},{pattern:/VueJS/gi,replacement:"Vue.js"},{pattern:/NextJS/gi,replacement:"Next.js"},{pattern:/ExpressJS/gi,replacement:"Express"}].forEach(({pattern:o,replacement:u})=>{r=r.replace(o,u)}),r}function Q(d){const r=new Map;return d.forEach(g=>{const o=H(g),u=o.toLowerCase();(!r.has(u)||o.length<r.get(u).length)&&r.set(u,o)}),Array.from(r.values())}console.log("GeminiService: Using OpenRouter AI via Supabase Edge Function proxy");const L=5e4,ce=3,de=1e3,M=d=>{const r=g=>{let o=g;return o=o.replace(/\/\*[\s\S]*?\*\//g,""),o=o.replace(/\/\/\s*Line\s*\d+\s*/g,""),o=o.split(/\r?\n/).map(y=>{if(/^\s*\/\//.test(y))return"";const S=y.indexOf("//");return S!==-1&&!y.slice(0,S).includes("://")?y.slice(0,S).trimEnd():y}).join(`
`),o=o.replace(/\n{3,}/g,`

`),o.trim()};if(typeof d=="string")return r(d);if(Array.isArray(d))return d.map(M);if(d&&typeof d=="object"){const g={};for(const o of Object.keys(d))g[o]=M(d[o]);return g}return d},W=async(d,r=ce)=>{let g=0,o=de;for(;g<r;)try{const u=await le.chatWithSystem("You are a professional resume optimization assistant. Always respond with valid JSON only.",d.prompt,{model:"google/gemini-2.5-flash",temperature:.3});if(!u)throw new Error("No content returned from OpenRouter");return{content:u}}catch(u){if(u.message.includes("429")||u.message.includes("500")||u.message.includes("Failed to fetch")||u.message.includes("NetworkError")){if(g++,g>=r)throw new Error(`OpenRouter API error: Failed after ${r} retries. ${u.message}`);console.warn(`OpenRouter API error: ${u.message}. Retrying in ${o/1e3}s... (Attempt ${g}/${r})`),await new Promise(y=>setTimeout(y,o)),o*=2;continue}throw u}throw new Error(`Failed after ${r} retries`)},he=async(d,r,g,o,u,y,S,R,C,E,h,s,c,O)=>{var D,$,U,F,z,G,J,V,B;console.log("═══════════════════════════════════════════════════════════"),console.log("🚀 RESUME OPTIMIZATION STARTED"),console.log("═══════════════════════════════════════════════════════════"),console.log("📝 Resume length:",d.length,"chars"),console.log("📋 JD length:",r.length,"chars"),console.log("👤 User type:",g),console.log("👤 User name:",o||"(not provided)");const A=Y(d),I=Y(r);if(console.log("✨ Applied version stripping to resume and JD"),A.length+I.length>L)throw new Error(`Input too long. Combined resume and job description exceed ${L} characters. Please shorten your input.`);const X=`${(i=>i==="experienced"?`You are a professional resume optimization assistant for EXPERIENCED PROFESSIONALS. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

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
8. Additional Sections (if provided, with custom titles)`:i==="student"?`You are a professional resume optimization assistant for COLLEGE STUDENTS. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

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
8. Additional Sections (if provided, with custom titles)`)(g)}

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
18. Ensure at least 70% of resume keywords match the job description.
19. NEVER use subjective adjectives like "passionate", "dedicated", "hardworking", "dynamic", "results-driven".
20. If user provides minimal info, EXPAND with SPECIFIC technical details, not generic impact phrases.

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
1. ONLY use technologies mentioned in the original resume OR job description
2. DO NOT invent project names, company names, or technical terms
3. Stick to facts from the original resume - enhance presentation, not content

PROJECT STRUCTURING REQUIREMENTS:
1. Project Title (e.g., "E-commerce Platform")
2. 2-3 impact bullets with VERB + TECH + specific detail pattern
3. Only 1 bullet per project should have a metric; others describe technical specifics

CERTIFICATION EXPANSION REQUIREMENTS:
1. Expand ALL abbreviated certification names to full official titles
2. Include certification provider in the title

JOB TITLE PLACEMENT REQUIREMENTS:
1. Job title from JD MUST appear in targetRole field and Professional Summary
2. Use exact job title wording from the JD when possible

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
2. GitHub URL: "${h||""}" - ONLY include if this is NOT empty
3. If LinkedIn URL is empty (""), set linkedin field to empty string ""
4. If GitHub URL is empty (""), set github field to empty string ""
5. DO NOT create, modify, or generate any social media links
6. Use EXACTLY what is provided - no modifications

TARGET ROLE INFORMATION:
${s?`Target Role: "${s}"`:"No specific target role provided"}

CONDITIONAL SECTION GENERATION: (Ensure these sections are generated based on user type)
${g==="experienced"?`
- Professional Summary: REQUIRED - Create a compelling 2-3 line summary
- Education: MINIMAL or OMIT unless specifically required by job
- Focus heavily on work experience and achievements
- Omit or minimize fresher-specific sections
`:g==="student"?`
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
4. Generate comprehensive skills section based on resume and job description
5. Only include sections that have meaningful content
6. If optional sections don't exist in original resume, set them as empty arrays or omit
7. Ensure all dates are in proper format (e.g., "Jan 2023 – Mar 2024")
8. Use professional language and industry-specific keywords from the job description
9. For LinkedIn and GitHub, use EXACTLY what is provided - empty string if not provided
10. The "name" field in the JSON should ONLY contain the user's name. The "email", "phone", "linkedin", "github", and "location" fields MUST NOT contain the user's name or any part of it. The user's name should appear ONLY in the dedicated "name" field.
11. CRITICAL: ALWAYS include the "projects" section in your response. If the original resume has projects, optimize them. If no projects exist, create 1-2 relevant projects based on the skills and job description.
12. CRITICAL: The "projects" array MUST NOT be empty. Every resume needs at least 1 project to demonstrate practical skills.
11. NEW: If 'additionalSections' are provided, include them in the output JSON with their custom titles and optimized bullet points. Apply all bullet point optimization rules to these sections as well.

JSON Structure:
{
  "name": "${o||"..."}",
  "location": "...", 
  "phone": "${S||"..."}",
  "email": "${y||"..."}",
  "linkedin": "${R||E||"..."}",
  "github": "${C||h||"..."}",
  "targetRole": "${s||"..."}",
  ${g==="experienced"?'"summary": "...",':""}
  ${g==="student"?'"careerObjective": "...",':""}
  ${g==="fresher"?'"careerObjective": "...",':""}
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
${A}

Job Description:
${I}

User Type: ${g.toUpperCase()}

LinkedIn URL provided: ${E||"NONE - leave empty"}
GitHub URL provided: ${h||"NONE - leave empty"}
`;let P=(await W({prompt:X})).content;if(!P)throw new Error("No content returned from EdenAI");const k=P.match(/```json\s*([\s\S]*?)\s*```/);let N;k&&k[1]?N=k[1].trim():N=P.replace(/```json/g,"").replace(/```/g,"").trim();try{let i=JSON.parse(N);i=M(i);const q=/^(?:n\/a|not\s*specified|none)$/i,x=e=>{if(typeof e=="string"){const t=e.trim();return q.test(t)?"":t}if(Array.isArray(e))return e.map(x);if(e&&typeof e=="object"){const t={};for(const p of Object.keys(e))t[p]=x(e[p]);return t}return e};if(i=x(i),i.skills&&Array.isArray(i.skills)){console.log("🛠️ Processing skills..."),console.log("   - Raw skills from AI:",JSON.stringify(i.skills));const e={"Programming Languages":[],"Frontend Technologies":[],"Backend Technologies":[],Databases:[],"Cloud & DevOps":[],"Data Science & ML":[],"Testing & QA":[],"Tools & Platforms":[]},t=n=>Array.isArray(n)?n.filter(f=>typeof f=="string"):n&&n.list&&Array.isArray(n.list)?n.list.filter(f=>typeof f=="string"):n&&n.skills&&Array.isArray(n.skills)?n.skills.filter(f=>typeof f=="string"):typeof n=="string"?n.split(",").map(f=>f.trim()).filter(Boolean):[];i.skills.forEach(n=>{t(n).forEach(b=>{if(!b||typeof b!="string")return;const m=H(b),l=m.toLowerCase().trim();if(l){if(Z.some(a=>l===a||l.includes(a))){e["Data Science & ML"].includes(m)||e["Data Science & ML"].push(m);return}if(!ee.some(a=>l.includes(a))){if(ie.some(a=>l===a||l.includes(a))){e["Frontend Technologies"].includes(m)||e["Frontend Technologies"].push(m);return}if(te.some(a=>l===a||l.includes(a))){e["Backend Technologies"].includes(m)||e["Backend Technologies"].push(m);return}if(ne.some(a=>l===a||l.includes(a))){e["Cloud & DevOps"].includes(m)||e["Cloud & DevOps"].push(m);return}if(se.some(a=>l===a||l.includes(a))){e.Databases.includes(m)||e.Databases.push(m);return}if(re.some(a=>l===a||l.includes(a))){e["Testing & QA"].includes(m)||e["Testing & QA"].push(m);return}if(oe.some(a=>l===a||l.includes(a))){e["Programming Languages"].includes(m)||e["Programming Languages"].push(m);return}if(ae.some(a=>l===a||l.includes(a))){e["Tools & Platforms"].includes(m)||e["Tools & Platforms"].push(m);return}e["Tools & Platforms"].includes(m)||e["Tools & Platforms"].push(m)}}})});const p=["Programming Languages","Frontend Technologies","Backend Technologies","Databases","Cloud & DevOps","Data Science & ML","Testing & QA","Tools & Platforms"];i.skills=p.filter(n=>e[n].length>0).map(n=>({category:n,count:Q(e[n]).length,list:Q(e[n])})),console.log("   - Reorganized skills:",i.skills.map(n=>`${n.category}: ${n.count}`)),i.skills.length<3&&console.log("   ⚠️ Too few skill categories after reorganization, may need to check AI response format")}if(i.certifications&&Array.isArray(i.certifications)){const e={aws:"Validates expertise in designing and deploying scalable systems on Amazon Web Services.",azure:"Demonstrates proficiency in Microsoft Azure cloud services and solutions architecture.",gcp:"Certifies knowledge of Google Cloud Platform infrastructure and application development.",kubernetes:"Validates skills in deploying, managing, and scaling containerized applications.",docker:"Demonstrates expertise in containerization and Docker ecosystem technologies.",pmp:"Certifies project management expertise following PMI standards and best practices.",scrum:"Validates understanding of Scrum framework and agile project management methodologies.",cissp:"Demonstrates advanced knowledge in information security and cybersecurity practices.",comptia:"Validates foundational IT skills and technical knowledge for IT professionals.",oracle:"Certifies expertise in Oracle database administration and development.",salesforce:"Demonstrates proficiency in Salesforce CRM platform and ecosystem.",terraform:"Validates infrastructure as code skills using HashiCorp Terraform."};i.certifications=i.certifications.map(t=>{if(typeof t=="string"){const p=t.toLowerCase();let n="";for(const[f,b]of Object.entries(e))if(p.includes(f)){n=b;break}return{title:t.trim(),description:n}}if(t&&typeof t=="object"){const p=typeof t.title=="string"&&t.title||typeof t.name=="string"&&t.name||typeof t.certificate=="string"&&t.certificate||typeof t.issuer=="string"&&t.issuer||typeof t.provider=="string"&&t.provider||"";let n=typeof t.description=="string"&&t.description||"";if(!n||n==="..."||n.length<10){const f=p.toLowerCase();for(const[b,m]of Object.entries(e))if(f.includes(b)){n=m;break}(!n||n.length<10)&&(n=`Professional certification validating expertise in ${p.split(" ").slice(0,3).join(" ")}.`)}return p?{title:p.trim(),description:n.trim()}:null}return{title:String(t),description:"Professional certification demonstrating technical expertise."}}).filter(Boolean)}i.workExperience&&Array.isArray(i.workExperience)&&(console.log("📝 Processing work experience bullets..."),i.workExperience=i.workExperience.filter(e=>e&&e.role&&e.company&&e.year).map(e=>{(!e.bullets||!Array.isArray(e.bullets))&&(e.bullets=[]),console.log(`   - ${e.role} at ${e.company}: ${e.bullets.length} bullets`);const t=(e.role||"").toLowerCase(),p=t.includes("data")||t.includes("analyst"),n=t.includes("frontend")||t.includes("front-end")||t.includes("ui"),f=t.includes("backend")||t.includes("back-end")||t.includes("server"),b=t.includes("full")||t.includes("stack"),m=t.includes("intern");let l=[];for(p?l=["Analyzed large datasets using Python and SQL, identifying key insights that improved business decisions by 25%.","Developed interactive dashboards and reports using Power BI/Tableau, enabling real-time data visualization for stakeholders.","Implemented data cleaning and ETL pipelines, reducing data processing time by 40% and improving data quality.","Collaborated with cross-functional teams to gather requirements and deliver data-driven solutions on schedule.","Automated repetitive data tasks using Python scripts, saving 10+ hours of manual work weekly."]:n?l=["Developed responsive web applications using React.js and modern CSS frameworks, improving user experience by 35%.","Implemented reusable UI components and design systems, reducing development time by 30% across projects.","Optimized frontend performance through code splitting and lazy loading, achieving 50% faster page load times.","Collaborated with UX designers to translate wireframes into pixel-perfect, accessible interfaces.","Integrated RESTful APIs and managed application state using Redux/Context API for seamless data flow."]:f?l=["Designed and developed RESTful APIs using Node.js/Python, handling 10,000+ daily requests with 99.9% uptime.","Implemented database optimization strategies, reducing query response time by 45% and improving scalability.","Built microservices architecture with Docker and Kubernetes, enabling seamless deployment and scaling.","Developed authentication and authorization systems using JWT and OAuth, ensuring secure user access.","Created automated testing suites achieving 85% code coverage, reducing production bugs by 40%."]:b?l=["Developed end-to-end web applications using React.js frontend and Node.js backend, serving 5,000+ users.","Designed and implemented database schemas in PostgreSQL/MongoDB, optimizing data retrieval by 35%.","Built CI/CD pipelines using GitHub Actions, reducing deployment time from hours to minutes.","Implemented responsive designs and RESTful APIs, ensuring seamless user experience across devices.","Collaborated with product teams to deliver features on schedule, maintaining high code quality standards."]:m?l=["Developed 5+ production features using React.js and Node.js, contributing to 15% increase in user engagement.","Collaborated with senior developers to implement new functionality, improving application performance by 20%.","Wrote 50+ unit tests achieving 80% code coverage, reducing production bugs by 30%.","Built RESTful APIs handling 1,000+ daily requests, ensuring 99% uptime during internship period.","Automated 3 manual processes using Python scripts, saving team 8+ hours weekly."]:l=["Developed and maintained software applications, improving system performance by 30% and reliability by 25%.","Delivered 10+ features on schedule, collaborating with cross-functional teams of 8+ members.","Implemented automated testing achieving 85% code coverage, reducing production bugs by 40%.","Optimized database queries and caching, reducing API response time by 45%.","Led technical initiatives impacting 5,000+ users, enhancing team productivity by 20%."];e.bullets.length<3;){const a=l.filter(j=>!e.bullets.some(K=>K.toLowerCase().slice(0,30)===j.toLowerCase().slice(0,30)));a.length>0?(e.bullets.push(a[0]),l=l.filter(j=>j!==a[0])):e.bullets.push(`Delivered ${e.role} responsibilities on schedule, achieving 95% stakeholder satisfaction.`)}return e.bullets=e.bullets.slice(0,3),console.log(`   - After processing: ${e.bullets.length} bullets`),e})),i.projects&&Array.isArray(i.projects)&&(i.projects=i.projects.filter(e=>e&&e.title).map(e=>{(!e.bullets||!Array.isArray(e.bullets))&&(e.bullets=[]);const t=["Designed and implemented core features using modern technologies, reducing development time by 30%.","Optimized application performance achieving 40% faster load times and improved user experience.","Deployed application with CI/CD pipeline, ensuring 99.9% uptime and serving 1,000+ users."];let p=0;for(;e.bullets.length<2&&p<t.length;){const n=t[p];e.bullets.some(f=>f.toLowerCase().includes(n.toLowerCase().slice(0,20)))||e.bullets.push(n),p++}return e.bullets=e.bullets.slice(0,3),e}).filter(e=>e.bullets&&e.bullets.length>0)),console.log("📊 Post-processing: Ensuring all bullets have quantified metrics...");const _=/\d+%|\$\d+|\d+\s*(users?|customers?|clients?|team|people|million|k\b|x\b|hours?|days?|weeks?|months?|engineers?|developers?|projects?|apis?|requests?|transactions?)/i,w=[", improving efficiency by 35%",", reducing processing time by 40%",", achieving 95% accuracy",", serving 1,000+ users",", with 99.9% uptime",", increasing performance by 30%",", reducing errors by 50%",", handling 5,000+ daily requests",", cutting development time by 25%",", improving user engagement by 45%"];let v=0;if(i.workExperience&&Array.isArray(i.workExperience)&&i.workExperience.forEach(e=>{e.bullets&&Array.isArray(e.bullets)&&(e.bullets=e.bullets.map(t=>{if(!_.test(t)){const p=w[v%w.length];v++;const n=t.replace(/\.?\s*$/,"");return console.log(`   📈 Adding metric to work bullet: "${n.slice(0,40)}..." -> "${p}"`),`${n}${p}.`}return t}))}),i.projects&&Array.isArray(i.projects)&&i.projects.forEach(e=>{e.bullets&&Array.isArray(e.bullets)&&(e.bullets=e.bullets.map(t=>{if(!_.test(t)){const p=w[v%w.length];v++;const n=t.replace(/\.?\s*$/,"");return console.log(`   📈 Adding metric to project bullet: "${n.slice(0,40)}..." -> "${p}"`),`${n}${p}.`}return t}))}),console.log(`   ✅ Added metrics to ${v} bullets`),i.additionalSections&&Array.isArray(i.additionalSections)&&(i.additionalSections=i.additionalSections.filter(e=>e&&e.title&&e.bullets&&e.bullets.length>0)),i.name=o||i.name||"",i.linkedin=R||i.linkedin||"",i.github=C||i.github||"",y)i.email=y;else if(i.email){const e=/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,t=String(i.email).match(e);i.email=t&&t[0]?t[0]:""}else i.email="";if(S)i.phone=S;else if(i.phone){const e=/(\+?\d{1,3}[-.\s]?)(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/,t=String(i.phone).match(e);i.phone=t&&t[0]?t[0]:""}else i.phone="";i.summary=String(i.summary||""),i.careerObjective=String(i.careerObjective||""),i.origin="jd_optimized",console.log("═══════════════════════════════════════════════════════════"),console.log("✅ RESUME OPTIMIZATION COMPLETED"),console.log("═══════════════════════════════════════════════════════════"),console.log("👤 Name:",i.name||"(missing)"),console.log("📧 Email:",i.email||"(missing)"),console.log("📱 Phone:",i.phone||"(missing)"),console.log("🔗 LinkedIn:",i.linkedin||"(missing)"),console.log("🐙 GitHub:",i.github||"(missing)"),console.log("📍 Location:",i.location||"(missing)"),console.log("🎯 Target Role:",i.targetRole||"(missing)"),console.log("📝 Summary:",i.summary?`${i.summary.slice(0,50)}...`:"(missing)"),console.log("🎓 Education entries:",((D=i.education)==null?void 0:D.length)||0),console.log("💼 Work experience entries:",(($=i.workExperience)==null?void 0:$.length)||0),console.log("🚀 Projects:",((U=i.projects)==null?void 0:U.length)||0),console.log("🛠️ Skill categories:",((F=i.skills)==null?void 0:F.length)||0),console.log("📜 Certifications:",((z=i.certifications)==null?void 0:z.length)||0);const T=[];return i.name||T.push("Name"),i.email||T.push("Email"),i.phone||T.push("Phone"),!i.summary&&!i.careerObjective&&T.push("Summary/Objective"),(G=i.education)!=null&&G.length||T.push("Education"),(J=i.workExperience)!=null&&J.length||T.push("Work Experience"),(V=i.projects)!=null&&V.length||T.push("Projects"),(B=i.skills)!=null&&B.length||T.push("Skills"),T.length>0?(console.warn("⚠️ MISSING SECTIONS:",T.join(", ")),(!i.projects||i.projects.length===0)&&(console.log("📝 Adding placeholder for projects section - will be populated from original resume"),i.projects=[]),(!i.skills||i.skills.length===0)&&(console.log("📝 Adding placeholder for skills section - will be populated from original resume"),i.skills=[])):console.log("✅ All sections populated"),console.log("═══════════════════════════════════════════════════════════"),i}catch(i){throw console.error("JSON parsing error:",i),console.error("Raw response attempted to parse:",N),new Error("Invalid JSON response from EdenAI")}},fe=async(d,r,g,o=3,u)=>{const y=JSON.stringify(r).length+((u==null?void 0:u.length)||0);if(y>L)throw new Error(`Input for variations too long (${y} characters). The maximum allowed is ${L} characters. Please shorten your input.`);const R=((h,s,c,O)=>{const A=`
CRITICAL ATS OPTIMIZATION RULES:
1. Use strong action verbs and industry keywords
2. Focus on quantifiable achievements and impact
3. Keep content concise
4. Avoid personal pronouns ("I", "my")
`;if(O)switch(h){case"summary":return`You are an expert resume writer specializing in ATS optimization for experienced professionals.
Generate ${c} distinctly different polished professional summary variations based on the following draft:
Draft: "${O}"
${A}
Each summary should be 2-3 sentences (50-80 words max).
Return ONLY a JSON array with exactly ${c} variations: ["summary1", "summary2", "summary3"]`;case"careerObjective":return`You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
Generate ${c} distinctly different polished career objective variations based on the following draft:
Draft: "${O}"
${A}
Each objective should be 2 sentences (30-50 words max) and have a different approach:
- Variation 1: Learning and growth-focused
- Variation 2: Skills and contribution-focused
- Variation 3: Career goals and enthusiasm-focused
Return ONLY a JSON array with exactly ${c} variations: ["objective1", "objective2", "objective3"]`}switch(h){case"summary":return`You are an expert resume writer specializing in ATS optimization for experienced professionals.
Generate ${c} distinctly different professional summary variations based on:
- User Type: ${s.userType}
- Target Role: ${s.targetRole||"General Professional Role"}
- Experience: ${JSON.stringify(s.experience||[])}
${A}
Each summary should be 2-3 sentences (50-80 words max) and have a different focus:
- Variation 1: Achievement-focused with metrics
- Variation 2: Skills and expertise-focused
- Variation 3: Leadership and impact-focused
Return ONLY a JSON array with exactly ${c} variations: ["summary1", "summary2", "summary3"]`;case"careerObjective":return`You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
Generate ${c} distinctly different career objective variations based on:
- User Type: ${s.userType}
- Target Role: ${s.targetRole||"Entry-level Professional Position"}
- Education: ${JSON.stringify(s.education||[])}
${A}
Each objective should be 2 sentences (30-50 words max) and have a different approach:
- Variation 1: Learning and growth-focused
- Variation 2: Skills and contribution-focused
- Variation 3: Career goals and enthusiasm-focused
Return ONLY a JSON array with exactly ${c} variations: ["objective1", "objective2", "objective3"]`;case"workExperienceBullets":return`You are an expert resume writer specializing in ATS optimization.
The following are DRAFT bullet points provided by the user for a work experience entry. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided role, company, and duration context.

DRAFT BULLET POINTS TO POLISH:
${s.description}

CONTEXT:
- Role: ${s.role}
- Company: ${s.company}
- Duration: ${s.year}
- User Type: ${s.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be concise with maximum 10 words.
2. Start each bullet with STRONG ACTION VERBS (Developed, Implemented, Led, Managed, Optimized, Achieved, Increased, Reduced)
3. NO weak verbs (helped, assisted, worked on, responsible for)
4. Include quantifiable achievements and metrics
5. Use industry-standard keywords
6. Focus on impact and results, not just responsibilities
7. Avoid repetitive words across bullets
8. Make each bullet distinct and valuable

Generate exactly ${c} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;case"projectBullets":return`You are an expert resume writer specializing in ATS optimization.
The following are DRAFT bullet points provided by the user for a project entry. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided project title, tech stack, and user type context.

DRAFT BULLET POINTS TO POLISH:
${s.description}

CONTEXT:
- Project Title: ${s.title}
- Tech Stack: ${s.techStack||"Modern technologies"}
- User Type: ${s.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be concise with maximum 10 words.
2. Start with STRONG ACTION VERBS (Developed, Built, Implemented, Designed, Created, Architected)
3. Include specific technologies mentioned in tech stack
4. Focus on technical achievements and impact
5. Include quantifiable results where possible
6. Use industry-standard technical keywords
7. Highlight problem-solving and innovation
8. Make each bullet showcase different aspects

Generate exactly ${c} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;case"additionalSectionBullets":return`You are an expert resume writer specializing in ATS optimization.

The following are DRAFT bullet points provided by the user for a custom section. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided section title and user type context.

DRAFT BULLET POINTS TO POLISH:
${s.details}

CONTEXT:
- Section Title: ${s.title}
- User Type: ${s.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be concise with maximum 10 words.
2. Start with STRONG ACTION VERBS (e.g., Awarded, Recognized, Achieved, Led, Volunteered, Fluent in)
3. Focus on achievements, contributions, or relevant details for the section type
4. Use industry-standard keywords where applicable
5. Quantify results where possible
6. Avoid repetitive words across bullets
7. Make each bullet distinct and valuable

Generate exactly ${c} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;case"certifications":return`You are an expert resume writer specializing in ATS optimization.

Given the following certification details and context:
- Current Certification Title: "${s.currentCertTitle||"Not provided"}"
- Current Certification Description: "${s.currentCertDescription||"Not provided"}"
- Target Role: ${s.targetRole||"Professional Role"}
- Current Skills: ${JSON.stringify(s.skills||[])}
- Job Description Context: ${s.jobDescription||"General professional context"}

Your task is to generate ${c} distinctly different polished and ATS-friendly titles for this certification.
Each title should be concise, professional, and highlight the most relevant aspect of the certification for a resume.
If the provided title/description is generic, make the generated titles more impactful and specific.

Return ONLY a JSON array with exactly ${c} polished certification titles: ["Polished Title 1", "Polished Title 2", "Polished Title 3"]`;case"achievements":return`You are an expert resume writer specializing in ATS optimization.

Generate ${c} different achievement variations based on:
- User Type: ${s.userType}
- Experience Level: ${s.experienceLevel||"Professional"}
- Target Role: ${s.targetRole||"Professional Role"}
- Context: ${s.context||"General professional achievements"}

${A}

Each achievement MUST be 2 lines and between 15-20 words.
Each variation should include 3-4 quantified achievements:
- Variation 1: Performance and results-focused
- Variation 2: Leadership and team impact-focused
- Variation 3: Innovation and process improvement-focused

Return ONLY a JSON array with exactly ${c} achievement lists: [["achievement1", "achievement2"], ["achievement3", "achievement4"], ["achievement5", "achievement6"]]`;case"skillsList":let I=`You are an expert resume writer specializing in ATS optimization.

Given the following skill category and existing skills:
- Category: ${s.category}
- Existing Skills (DRAFT): ${s.existingSkills||"None"}
- User Type: ${s.userType}
- Job Description: ${s.jobDescription||"None"}

CRITICAL REQUIREMENTS:
1. Provide 5-8 specific and relevant skills for the given category.
2. Prioritize skills mentioned in the job description or commonly associated with the user type and category.
3. Ensure skills are ATS-friendly.

`;return s.category==="Databases"&&(I+=`
IMPORTANT: For the 'Databases' category, the suggestions MUST be database languages (e.g., SQL, T-SQL, PL/SQL, MySQL, PostgreSQL, MongoDB, Oracle, Cassandra, Redis, DynamoDB, Firebase, Supabase), not theoretical topics like normalization, indexing, or database design principles. Focus on specific technologies and query languages.
`),I+=`
Return ONLY a JSON array of strings: ["skill1", "skill2", "skill3", "skill4", "skill5"]`,I;default:return`Generate ${c} ATS-optimized variations for ${h}.`}})(d,r,o,u);let E=(await W({prompt:R})).content;if(!E)throw new Error("No response content from EdenAI");E=E.replace(/```json/g,"").replace(/```/g,"").trim();try{const h=JSON.parse(E);return Array.isArray(h)&&!h.every(Array.isArray)?h.map(s=>[s]):Array.isArray(h)&&h.every(Array.isArray)?h.slice(0,o):[E.split(`
`).map(c=>c.replace(/^[•\-\*]\s*/,"").trim()).filter(c=>c.length>0).slice(0,o)]}catch(h){return console.error(`JSON parsing error for ${d}:`,h),console.error("Raw response that failed to parse:",E),[E.split(`
`).map(c=>c.replace(/^[•\-\*]\s*/,"").trim()).filter(c=>c.length>0).slice(0,o)]}};export{fe as g,he as o};
