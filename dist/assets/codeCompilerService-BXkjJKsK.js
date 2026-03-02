var y=Object.defineProperty;var h=(p,t,s)=>t in p?y(p,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):p[t]=s;var d=(p,t,s)=>h(p,typeof t!="symbol"?t+"":t,s);import{s as m}from"./index-NlwF7PvK.js";import{g}from"./geminiServiceWrapper-D3UXo9gk.js";class f{constructor(){d(this,"JUDGE0_API","https://judge0-ce.p.rapidapi.com");d(this,"RAPIDAPI_KEY");d(this,"RAPIDAPI_HOST","judge0-ce.p.rapidapi.com");d(this,"languageIds",{Python:71,JavaScript:63,Java:62,"C++":54,C:50,"C#":51,Go:60,Ruby:72,PHP:68,Swift:83,Kotlin:78,Rust:73,TypeScript:74})}async generateTestCases(t,s){const a=`
You are a test case generator for coding interviews.

Question: ${t}
Programming Language: ${s}

Generate EXACTLY 2 test cases that:
1. Test basic functionality (simple case)
2. Test edge cases or complex scenarios

Format your response as JSON:
{
  "testCases": [
    {
      "input": "test input as string",
      "expectedOutput": "expected output as string",
      "description": "what this test case checks"
    },
    {
      "input": "test input as string",
      "expectedOutput": "expected output as string",
      "description": "what this test case checks"
    }
  ]
}

Important: Keep inputs and outputs simple and clear. For functions, provide the function call with arguments.
`;try{const o=await g.generateText(a);return this.parseJSONResponse(o).testCases||this.createFallbackTestCases()}catch(o){return console.error("Error generating test cases:",o),this.createFallbackTestCases()}}async executeCode(t,s,a){if(!this.RAPIDAPI_KEY)return this.mockExecuteCode(t,s,a);const o=this.languageIds[s];if(!o)return{success:!1,error:`Unsupported language: ${s}`};try{const e=[];let r=0;for(const i of a){const n=await this.executeWithTestCase(t,o,i);e.push(n),n.executionTime&&(r+=n.executionTime)}const c=e.every(i=>i.passed);return{success:!0,executionResults:e,allTestsPassed:c,totalExecutionTime:r}}catch(e){return console.error("Code execution error:",e),{success:!1,error:e instanceof Error?e.message:"Execution failed"}}}async executeWithTestCase(t,s,a){try{const o={source_code:btoa(t),language_id:s,stdin:btoa(a.input)},e=await fetch(`${this.JUDGE0_API}/submissions?base64_encoded=true&wait=true`,{method:"POST",headers:{"content-type":"application/json","X-RapidAPI-Key":this.RAPIDAPI_KEY,"X-RapidAPI-Host":this.RAPIDAPI_HOST},body:JSON.stringify(o)});if(!e.ok)throw new Error(`Judge0 API error: ${e.statusText}`);const r=await e.json(),c=r.stdout?atob(r.stdout).trim():"",i=r.stderr?atob(r.stderr):r.compile_output?atob(r.compile_output):void 0,n=c===a.expectedOutput.trim()&&!i;return{testCase:a,actualOutput:c||i||"No output",passed:n,executionTime:r.time?parseFloat(r.time)*1e3:void 0,error:i}}catch(o){return{testCase:a,actualOutput:"",passed:!1,error:o instanceof Error?o.message:"Execution failed"}}}mockExecuteCode(t,s,a){const o=a.map((e,r)=>{const c=r===0;return{testCase:e,actualOutput:c?e.expectedOutput:"Mock output",passed:c,executionTime:Math.random()*100+50}});return{success:!0,executionResults:o,allTestsPassed:o.every(e=>e.passed),totalExecutionTime:o.reduce((e,r)=>e+(r.executionTime||0),0),output:"Mock execution - Configure RAPIDAPI_KEY for real execution"}}async saveExecutionResult(t,s,a,o,e,r){const c=r.every(u=>u.passed),i=r.reduce((u,x)=>u+(x.executionTime||0),0),{data:n,error:l}=await m.from("code_execution_results").insert({response_id:t,session_id:s,code:a,language:o,test_cases:e,execution_results:r,all_tests_passed:c,execution_time_ms:Math.round(i),errors:r.filter(u=>u.error).map(u=>u.error).join(`
`)||null}).select().single();if(l)throw l;return n}async getExecutionResults(t){const{data:s,error:a}=await m.from("code_execution_results").select("*").eq("response_id",t).order("created_at",{ascending:!1});if(a)throw a;return s||[]}async analyzeCodeQuality(t,s,a){const o=`
You are an expert code reviewer. Analyze this code submission for a coding interview.

Question: ${a}
Language: ${s}
Code:
\`\`\`${s.toLowerCase()}
${t}
\`\`\`

Provide analysis on:
1. Code correctness and logic
2. Time and space complexity
3. Code quality and readability
4. Best practices followed/violated
5. Potential improvements

Format your response as JSON:
{
  "correctness": "assessment of logic correctness",
  "complexity": "time and space complexity analysis",
  "codeQuality": "code quality assessment",
  "bestPractices": ["practice1", "practice2"],
  "improvements": ["improvement1", "improvement2"],
  "score": 0-100
}
`;try{const e=await g.generateText(o);return this.parseJSONResponse(e)}catch(e){return console.error("Error analyzing code quality:",e),{correctness:"Unable to analyze",complexity:"N/A",codeQuality:"N/A",bestPractices:[],improvements:[],score:50}}}getSupportedLanguages(){return Object.keys(this.languageIds)}parseJSONResponse(t){try{const s=t.match(/\{[\s\S]*\}/);return JSON.parse(s?s[0]:t)}catch{return{}}}createFallbackTestCases(){return[{input:"test input 1",expectedOutput:"expected output 1",description:"Basic functionality test"},{input:"test input 2",expectedOutput:"expected output 2",description:"Edge case test"}]}}const v=new f;export{v as c};
