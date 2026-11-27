import{s as i}from"./index-B986Edom.js";import{r as g}from"./resumeParsingService-DZHg1VN8.js";import{g as y}from"./geminiServiceWrapper-CbLe2cYk.js";class w{async uploadAndAnalyzeResume(e,t){const s=g.validateFile(e);if(!s.valid)throw new Error(s.error||"Invalid file");const r=(c=>{const u=c.lastIndexOf("."),_=(u>0?c.slice(0,u):c).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/-{2,}/g,"-").replace(/^[-_.]+|[-_.]+$/g,""),p=(u>0?c.slice(u+1):"").replace(/[^A-Za-z0-9]/g,"").slice(0,10);return((p?`${_}.${p}`:_)||`resume_${Date.now()}.pdf`).slice(0,120)})(e.name),n=`${t}/${Date.now()}_${r}`,{error:l}=await i.storage.from("user-resumes").upload(n,e,{contentType:e.type,upsert:!1});if(l)throw new Error(`Failed to upload resume: ${l.message}`);const{data:f}=i.storage.from("user-resumes").getPublicUrl(n),o=await g.parseResume(e);if(o.hasError)throw new Error(o.errorMessage||"Failed to parse resume");const{data:d,error:m}=await i.from("user_resumes").insert({user_id:t,file_url:f.publicUrl,file_name:e.name,file_type:e.type,file_size:e.size,parsed_text:o.text,parsed_data:{},skills_detected:o.skills,analysis_completed:!1,is_primary:!1}).select().single();if(m)throw new Error(`Failed to save resume: ${m.message}`);return this.analyzeResumeInBackground(d.id,o.text,t),d}async analyzeResumeInBackground(e,t,s){try{const a=await this.performDeepAnalysis(t);await i.from("user_resumes").update({parsed_data:a.parsed_data,skills_detected:a.skills_detected,experience_level:a.experience_level,years_of_experience:a.years_of_experience,domains:a.domains,analysis_metadata:a.analysis_metadata,analysis_completed:!0}).eq("id",e)}catch(a){console.error("Background analysis failed:",a)}}async performDeepAnalysis(e){const t=`Analyze this resume and extract structured information. Return a valid JSON object with the following structure:

{
  "parsed_data": {
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "summary": "string or null",
    "education": [{"degree": "string", "institution": "string", "year": "string", "gpa": "string", "location": "string"}],
    "work_experience": [{"title": "string", "company": "string", "duration": "string", "location": "string", "responsibilities": ["string"], "technologies": ["string"]}],
    "projects": [{"name": "string", "description": "string", "technologies": ["string"], "url": "string", "highlights": ["string"]}],
    "skills": [{"category": "string", "skills": ["string"]}],
    "certifications": ["string"],
    "achievements": ["string"]
  },
  "skills_detected": ["string"],
  "experience_level": "entry|junior|mid|senior|lead|executive",
  "years_of_experience": number,
  "domains": ["string"],
  "analysis_metadata": {
    "total_skills_count": number,
    "technical_skills_count": number,
    "soft_skills_count": number,
    "projects_count": number,
    "work_experiences_count": number,
    "education_count": number,
    "confidence_score": number (0-1),
    "analysis_version": "1.0",
    "analyzed_at": "ISO timestamp"
  }
}

Resume Text:
${e}

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.`;try{const a=(await y.generateText(t)).replace(/```json\n?/g,"").replace(/```\n?/g,"").trim(),r=JSON.parse(a);return{parsed_data:r.parsed_data||this.getDefaultParsedData(),skills_detected:r.skills_detected||[],experience_level:r.experience_level||"junior",years_of_experience:r.years_of_experience||0,domains:r.domains||[],analysis_metadata:r.analysis_metadata||this.getDefaultMetadata()}}catch(s){return console.error("AI analysis failed, using fallback:",s),this.getFallbackAnalysis(e)}}getDefaultParsedData(){return{education:[],work_experience:[],projects:[],skills:[],certifications:[],achievements:[]}}getDefaultMetadata(){return{total_skills_count:0,technical_skills_count:0,soft_skills_count:0,projects_count:0,work_experiences_count:0,education_count:0,confidence_score:0,analysis_version:"1.0",analyzed_at:new Date().toISOString()}}getFallbackAnalysis(e){const s=["JavaScript","Python","React","Node.js","TypeScript","Java","SQL","MongoDB","AWS","Docker","Kubernetes","Git"].filter(l=>e.toLowerCase().includes(l.toLowerCase())),a=e.match(/(\d+)\+?\s*years?/i),r=a?parseInt(a[1]):1;let n="junior";return r>=7?n="senior":r>=4?n="mid":r>=2?n="junior":n="entry",{parsed_data:this.getDefaultParsedData(),skills_detected:s,experience_level:n,years_of_experience:r,domains:this.detectDomains(e),analysis_metadata:{...this.getDefaultMetadata(),total_skills_count:s.length,technical_skills_count:s.length,confidence_score:.5}}}detectDomains(e){return["Frontend Development","Backend Development","Full Stack Development","Mobile Development","Data Science","Machine Learning","DevOps","Cloud Engineering"].filter(s=>e.toLowerCase().includes(s.toLowerCase()))}async getUserResumes(e){const{data:t,error:s}=await i.from("user_resumes").select("*").eq("user_id",e).order("created_at",{ascending:!1});if(s)throw new Error(`Failed to fetch resumes: ${s.message}`);return t||[]}async getPrimaryResume(e){const{data:t,error:s}=await i.from("user_resumes").select("*").eq("user_id",e).eq("is_primary",!0).maybeSingle();if(s)throw new Error(`Failed to fetch primary resume: ${s.message}`);return t}async getResumeById(e){const{data:t,error:s}=await i.from("user_resumes").select("*").eq("id",e).maybeSingle();if(s)throw new Error(`Failed to fetch resume: ${s.message}`);return t}async setPrimaryResume(e,t){const{error:s}=await i.from("user_resumes").update({is_primary:!0}).eq("id",e).eq("user_id",t);if(s)throw new Error(`Failed to set primary resume: ${s.message}`)}async deleteResume(e,t){const s=await this.getResumeById(e);if(!s||s.user_id!==t)throw new Error("Resume not found or unauthorized");const a=s.file_url.split("/user-resumes/")[1];a&&await i.storage.from("user-resumes").remove([a]);const{error:r}=await i.from("user_resumes").delete().eq("id",e).eq("user_id",t);if(r)throw new Error(`Failed to delete resume: ${r.message}`)}async waitForAnalysis(e,t=30){const s=Date.now();for(;Date.now()-s<t*1e3;){const r=await this.getResumeById(e);if(r!=null&&r.analysis_completed)return r;await new Promise(n=>setTimeout(n,1e3))}const a=await this.getResumeById(e);if(!a)throw new Error("Resume not found");return a}}const b=new w;export{b as r};
