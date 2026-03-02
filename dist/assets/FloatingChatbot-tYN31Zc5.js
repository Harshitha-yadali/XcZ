import{j as e,A as x,m as y}from"./vendor-motion-_XdJ9pBm.js";import{r as c}from"./vendor-react-B4msnGgW.js";import{c as I,N as C,O as z,Z as T,X as v,i as B,y as O}from"./index-NlwF7PvK.js";import{S as F}from"./send-BLOh4naW.js";import"./vendor-pdf-B1igRwBP.js";import"./vendor-supabase-B_87WqdG.js";import"./vendor-forms-BxTF4-4_.js";/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=I("Bot",[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]]),E=z("ai-proxy"),M=[{keywords:["what is primoboost","about primoboost","tell me about","what does primoboost do","primoboost ai"],response:`PrimoBoost AI is an AI-powered career platform that helps you optimize your resume for ATS systems, match with relevant jobs, and prepare for interviews.

Our tools analyze your resume against job descriptions and provide actionable improvements to increase your interview callback rate.`},{keywords:["optimize","resume optimization","improve resume","fix resume","enhance resume","rewrite resume"],response:`To optimize your resume:

1. Go to the Resume Optimizer from the AI Tools menu
2. Upload your resume (PDF or text)
3. Paste the job description you're targeting
4. Our AI analyzes keyword alignment, ATS compatibility, and content quality
5. Get specific suggestions to improve your match score

The optimizer checks 16 parameters including skills match, experience relevance, and formatting.`},{keywords:["ats score","score checker","check score","ats check","resume score","how good is my resume"],response:`The ATS Score Checker evaluates your resume across 16 key parameters:

- Keyword matching with the job description
- Skills alignment and gap analysis
- Experience relevance scoring
- Formatting and structure compliance
- Content quality assessment

Upload your resume and paste a job description to get your detailed score breakdown.`},{keywords:["job","jobs","job listing","latest jobs","find jobs","job search","openings"],response:`We post fresh job listings daily across multiple industries and experience levels.

Visit the Latest Jobs page to browse current openings. You can filter by role, location, and experience level. Each listing shows the full job description so you can optimize your resume specifically for that role.`},{keywords:["price","pricing","plan","subscription","cost","buy","payment","pay","credit"],response:`Our plans (50% OFF - one-time purchase):

Leader Plan - Rs.16,400 - 100 Resume Credits
Achiever Plan - Rs.13,200 - 50 Resume Credits
Accelerator Plan - Rs.11,600 - 25 Resume Credits
Starter Plan - Rs.1,640 - 10 Resume Credits
Kickstart Plan - Rs.1,320 - 5 Resume Credits

Each plan includes Resume Optimizations, ATS Score Checks, and Premium Support.

For billing inquiries, email primoboostai@gmail.com.`},{keywords:["contact","support","help","email","reach","talk to","customer service"],response:`You can reach our support team at:

Email: primoboostai@gmail.com

Our team typically responds within 2 minutes during business hours. For payment or billing issues, please include a screenshot of the issue in your email.`},{keywords:["interview","mock interview","interview prep","practice interview"],response:`PrimoBoost offers multiple interview preparation tools:

- Mock Interviews with AI-generated questions based on your target role
- Resume-Based Interviews that test you on your own experience
- Smart Coding Interviews for technical roles
- Real-time feedback and performance scoring

Find these under the AI Tools menu.`},{keywords:["portfolio","portfolio builder","create portfolio","build portfolio"],response:`The Portfolio Builder helps you create a professional online portfolio showcasing your projects and skills.

You can add project descriptions, link to repositories, and organize your work in a clean, presentable format that you can share with potential employers.`},{keywords:["linkedin","linkedin message","linkedin generator","cold message","outreach"],response:`The LinkedIn Message Generator creates personalized connection requests and outreach messages.

It uses the job description and your profile to craft compelling messages for recruiters and hiring managers, helping you stand out in their inbox.`},{keywords:["webinar","webinars","live session","workshop"],response:`We host regular webinars and live sessions on resume building, interview preparation, and career growth strategies.

Check the Webinars page for upcoming sessions. You can register and get reminders before each event.`},{keywords:["guided builder","build resume","create resume","resume builder","new resume"],response:`The Guided Resume Builder walks you through creating a professional resume step by step.

It covers all essential sections: contact info, summary, experience, education, skills, projects, and certifications. Perfect for freshers or anyone starting from scratch.`},{keywords:["gaming","aptitude","spatial reasoning","cognitive","game","assessment"],response:`Our Gaming & Aptitude section helps you prepare for cognitive assessments used by top companies.

Available games include Spatial Reasoning, Path Finder, Key Finder, and Bubble Selection - all modeled after real assessment tests used in hiring.`},{keywords:["fresher","no experience","first job","graduate","entry level","beginner"],response:`PrimoBoost is great for freshers! Here's how to get started:

1. Use the Guided Resume Builder to create your first resume
2. Highlight projects, internships, and coursework
3. Use the ATS Score Checker to ensure your resume passes filters
4. Browse Latest Jobs for entry-level openings
5. Practice with Mock Interviews

Even without work experience, a well-optimized resume makes a strong impression.`},{keywords:["pdf","export","download","save resume"],response:`You can export your optimized resume as a PDF directly from the preview panel.

After optimization, click the Export/Download button to save your ATS-friendly resume ready for submission.`},{keywords:["blog","articles","career tips","resources"],response:`Visit our Blog for the latest career tips, resume writing guides, interview strategies, and industry insights.

We regularly publish content to help you stay ahead in your job search.`},{keywords:["refund","money back","cancel","cancellation"],response:`For refund requests or cancellation inquiries, please email primoboostai@gmail.com with your account details and a screenshot of your purchase.

Our team will review and respond within 2 minutes during business hours.`},{keywords:["how to use","tutorial","guide","getting started","start","how it works"],response:`Getting started with PrimoBoost AI is easy:

1. Sign up for a free account
2. Upload your resume (PDF or paste text)
3. Paste the job description you're targeting
4. Get your ATS score and optimization suggestions
5. Apply the improvements and export your optimized resume

Check the Tutorials page for detailed walkthroughs of each feature.`}];function k(r){return r.toLowerCase().replace(/[^a-z0-9\s]/g,"").trim()}function q(r){const i=k(r),t=i.split(/\s+/);let o=0,a=null;for(const l of M){let n=0;for(const p of l.keywords){const d=k(p);if(i.includes(d))n+=d.split(/\s+/).length*3;else{const h=d.split(/\s+/);for(const g of h)t.includes(g)&&(n+=1)}}n>o&&(o=n,a=l.response)}return o>=1?a:null}async function L(r){var i,t,o;try{const a=await C(E,{method:"POST",headers:{Authorization:`Bearer ${T}`,"Content-Type":"application/json"},body:JSON.stringify({service:"openrouter",action:"chat_with_system",systemPrompt:`You are PrimoBoost AI, the support assistant for PrimoBoostAI.in - an AI-powered resume optimization and career platform.

Rules:
- Keep responses under 5 lines, conversational and professional.
- Never use markdown formatting, bold, asterisks, or emojis.
- Answer questions about resume optimization, job listings, interview prep, pricing, and platform features.
- For payment/billing issues, direct users to email primoboostai@gmail.com.

Pricing (50% OFF, one-time purchase):
Leader Plan - Rs.16,400 - 100 Resume Credits
Achiever Plan - Rs.13,200 - 50 Resume Credits
Accelerator Plan - Rs.11,600 - 25 Resume Credits
Starter Plan - Rs.1,640 - 10 Resume Credits
Kickstart Plan - Rs.1,320 - 5 Resume Credits`,userPrompt:r,model:"google/gemini-2.5-flash",temperature:.4})});if(!a.ok)return null;const l=await a.json();return((o=(t=(i=l==null?void 0:l.choices)==null?void 0:i[0])==null?void 0:t.message)==null?void 0:o.content)||null}catch{return null}}async function D(r){const i=q(r),t=await L(r);return t||i||`I can help you with resume optimization, ATS scores, job listings, interview prep, pricing, and more.

Could you rephrase your question? Or feel free to email primoboostai@gmail.com for personalized support.`}const j={role:"assistant",content:`Hi there! I'm the PrimoBoost AI Assistant. I can help you with resume optimization, ATS scores, job listings, interview prep, pricing, and more.

How can I help you today?`,timestamp:new Date},G=["What is PrimoBoost AI?","How do I optimize my resume?","Tell me about pricing","Job listings","Interview prep","How to contact support?"],J=()=>{const[r,i]=c.useState(!1),[t,o]=c.useState([j]),[a,l]=c.useState(""),[n,p]=c.useState(!1),d=c.useRef(null),h=c.useRef(null),g=c.useCallback(()=>{var s;(s=d.current)==null||s.scrollIntoView({behavior:"smooth"})},[]);c.useEffect(()=>{g()},[t,n,g]),c.useEffect(()=>{r&&setTimeout(()=>{var s;return(s=h.current)==null?void 0:s.focus()},300)},[r]);const b=()=>{r&&o([j]),i(s=>!s)},w=async s=>{const m=s.trim();if(!m||n)return;const S={role:"user",content:m,timestamp:new Date};o(u=>[...u,S]),l(""),p(!0);try{const u=await D(m);o(P=>[...P,{role:"assistant",content:u,timestamp:new Date}])}catch{o(u=>[...u,{role:"assistant",content:"I'm having trouble responding right now. Please try again or email primoboostai@gmail.com for quick support.",timestamp:new Date}])}finally{p(!1)}},N=s=>{s.preventDefault(),w(a)},A=s=>s.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),R=t.length<=1;return e.jsxs("div",{className:"fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6",children:[e.jsx(x,{children:r&&e.jsxs(y.div,{initial:{opacity:0,y:20,scale:.95},animate:{opacity:1,y:0,scale:1},exit:{opacity:0,y:20,scale:.95},transition:{type:"spring",damping:25,stiffness:300},className:"absolute bottom-16 right-0 mb-2 w-[340px] sm:w-[380px] overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900 shadow-2xl shadow-black/40",children:[e.jsxs("div",{className:"flex items-center gap-3 border-b border-gray-700/50 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-4 py-3",children:[e.jsxs("div",{className:"relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30",children:[e.jsx(f,{className:"h-4.5 w-4.5 text-emerald-400"}),e.jsx("span",{className:"absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-900 bg-emerald-400"})]}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-100",children:"PrimoBoost AI"}),e.jsx("p",{className:"text-[11px] text-emerald-400/80",children:"Online - Ready to help"})]}),e.jsx("button",{onClick:b,className:"flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-200","aria-label":"Close chat",children:e.jsx(v,{className:"h-4 w-4"})})]}),e.jsxs("div",{className:"flex h-[380px] flex-col",children:[e.jsxs("div",{className:"flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin",children:[t.map((s,m)=>e.jsxs("div",{className:`flex gap-2 ${s.role==="user"?"flex-row-reverse":"flex-row"}`,children:[e.jsx("div",{className:`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${s.role==="user"?"bg-cyan-500/15 text-cyan-400":"bg-emerald-500/15 text-emerald-400"}`,children:s.role==="user"?e.jsx(B,{className:"h-3.5 w-3.5"}):e.jsx(f,{className:"h-3.5 w-3.5"})}),e.jsxs("div",{className:`max-w-[80%] ${s.role==="user"?"text-right":""}`,children:[e.jsx("div",{className:`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${s.role==="user"?"rounded-br-md bg-cyan-600 text-white":"rounded-bl-md bg-gray-800 text-gray-200 ring-1 ring-gray-700/50"}`,children:s.content}),e.jsx("p",{className:`mt-1 text-[10px] text-gray-500 ${s.role==="user"?"text-right":""}`,children:A(s.timestamp)})]})]},m)),n&&e.jsxs("div",{className:"flex gap-2",children:[e.jsx("div",{className:"flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400",children:e.jsx(f,{className:"h-3.5 w-3.5"})}),e.jsx("div",{className:"rounded-2xl rounded-bl-md bg-gray-800 px-4 py-3 ring-1 ring-gray-700/50",children:e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:0ms]"}),e.jsx("span",{className:"h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms]"}),e.jsx("span",{className:"h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms]"})]})})]}),e.jsx("div",{ref:d})]}),R&&e.jsxs("div",{className:"border-t border-gray-700/50 bg-gray-800/50 px-3 py-2.5",children:[e.jsx("p",{className:"mb-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider",children:"Quick Questions"}),e.jsx("div",{className:"flex flex-wrap gap-1.5",children:G.map(s=>e.jsx("button",{onClick:()=>w(s),className:"rounded-full border border-gray-600/50 bg-gray-800 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300",children:s},s))})]}),e.jsxs("form",{onSubmit:N,className:"flex items-center gap-2 border-t border-gray-700/50 bg-gray-900 px-3 py-2.5",children:[e.jsx("input",{ref:h,value:a,onChange:s=>l(s.target.value),placeholder:"Type your question...",disabled:n,className:"flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-[13px] text-gray-100 placeholder-gray-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"}),e.jsx("button",{type:"submit",disabled:n||!a.trim(),className:"flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600",children:e.jsx(F,{className:"h-4 w-4"})})]})]})]},"chat-window")}),e.jsx(y.button,{onClick:b,whileHover:{scale:1.05},whileTap:{scale:.95},className:"flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-shadow hover:shadow-xl hover:shadow-emerald-500/30","aria-label":r?"Close chat":"Open chat",children:e.jsx(x,{mode:"wait",children:r?e.jsx(y.div,{initial:{rotate:-90,opacity:0},animate:{rotate:0,opacity:1},exit:{rotate:90,opacity:0},transition:{duration:.15},children:e.jsx(v,{className:"h-6 w-6"})},"close"):e.jsx(y.div,{initial:{rotate:90,opacity:0},animate:{rotate:0,opacity:1},exit:{rotate:-90,opacity:0},transition:{duration:.15},children:e.jsx(O,{className:"h-6 w-6"})},"open")})})]})};export{J as FloatingChatbot};
