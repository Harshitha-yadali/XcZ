export interface TechCategory {
  name: string;
  keywords: string[];
}

export const TECH_CATEGORIES: TechCategory[] = [
  {
    name: 'Frontend',
    keywords: [
      'React', 'Angular', 'Vue.js', 'Next.js', 'Nuxt.js', 'Svelte', 'SvelteKit',
      'HTML', 'CSS', 'JavaScript', 'TypeScript', 'jQuery', 'Bootstrap', 'Tailwind CSS',
      'Material UI', 'Chakra UI', 'Ant Design', 'Sass', 'LESS', 'Styled Components',
      'Redux', 'Zustand', 'MobX', 'Recoil', 'Webpack', 'Vite', 'Babel', 'ESLint',
      'Storybook', 'Gatsby', 'Remix', 'Astro', 'Web Components', 'PWA',
    ],
  },
  {
    name: 'Backend',
    keywords: [
      'Node.js', 'Express.js', 'NestJS', 'Fastify', 'Koa', 'Python', 'Django',
      'Flask', 'FastAPI', 'Java', 'Spring Boot', 'Spring MVC', 'Hibernate',
      'C#', '.NET', 'ASP.NET', 'Go', 'Gin', 'Fiber', 'Rust', 'Actix',
      'PHP', 'Laravel', 'Symfony', 'Ruby', 'Ruby on Rails', 'Scala', 'Play Framework',
      'Kotlin', 'Ktor', 'Elixir', 'Phoenix', 'GraphQL', 'REST API', 'gRPC',
      'Microservices', 'Serverless', 'WebSocket',
    ],
  },
  {
    name: 'Mobile Development',
    keywords: [
      'React Native', 'Flutter', 'Dart', 'Swift', 'SwiftUI', 'Objective-C',
      'Kotlin Android', 'Jetpack Compose', 'Xamarin', 'Ionic', 'Capacitor',
      'Expo', 'Android SDK', 'iOS SDK', 'Mobile UI/UX', 'App Store Optimization',
    ],
  },
  {
    name: 'Database',
    keywords: [
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle DB',
      'Microsoft SQL Server', 'DynamoDB', 'Cassandra', 'CouchDB', 'Firebase Realtime DB',
      'Firestore', 'Supabase', 'PlanetScale', 'Neo4j', 'ElasticSearch',
      'InfluxDB', 'TimescaleDB', 'Prisma', 'TypeORM', 'Sequelize', 'Drizzle ORM',
      'Mongoose', 'SQL', 'NoSQL',
    ],
  },
  {
    name: 'Cloud & DevOps',
    keywords: [
      'AWS', 'Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes', 'Terraform',
      'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI/CD', 'CircleCI',
      'AWS Lambda', 'AWS EC2', 'AWS S3', 'AWS RDS', 'AWS ECS', 'AWS EKS',
      'Azure DevOps', 'Azure Functions', 'Google Cloud Functions', 'Cloud Run',
      'Vercel', 'Netlify', 'Heroku', 'DigitalOcean', 'Cloudflare',
      'Nginx', 'Apache', 'Linux', 'Bash', 'Shell Scripting',
      'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'ELK Stack',
      'ArgoCD', 'Helm', 'Istio', 'Service Mesh',
    ],
  },
  {
    name: 'AI & Machine Learning',
    keywords: [
      'Machine Learning', 'Deep Learning', 'Artificial Intelligence', 'NLP',
      'Computer Vision', 'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn',
      'Pandas', 'NumPy', 'OpenCV', 'Hugging Face', 'LangChain', 'LLM',
      'GPT', 'Generative AI', 'Prompt Engineering', 'RAG',
      'Reinforcement Learning', 'Transfer Learning', 'MLOps', 'MLflow',
      'Kubeflow', 'SageMaker', 'Vertex AI', 'ONNX', 'Stable Diffusion',
      'Transformers', 'BERT', 'Neural Networks', 'Feature Engineering',
    ],
  },
  {
    name: 'Data Engineering & Analytics',
    keywords: [
      'Data Science', 'Data Engineering', 'Data Analytics', 'Big Data',
      'Apache Spark', 'Apache Kafka', 'Apache Airflow', 'Apache Flink',
      'Hadoop', 'Hive', 'Presto', 'dbt', 'Snowflake', 'Databricks',
      'Redshift', 'BigQuery', 'Power BI', 'Tableau', 'Looker',
      'ETL', 'Data Warehousing', 'Data Modeling', 'Data Pipeline',
      'R', 'MATLAB', 'SAS', 'Jupyter', 'Apache Beam',
    ],
  },
  {
    name: 'Cybersecurity',
    keywords: [
      'Cybersecurity', 'Penetration Testing', 'Ethical Hacking', 'OWASP',
      'Network Security', 'Application Security', 'Cloud Security',
      'SIEM', 'SOC', 'Incident Response', 'Vulnerability Assessment',
      'Identity & Access Management', 'Zero Trust', 'Encryption',
      'Compliance', 'ISO 27001', 'SOC 2', 'GDPR', 'Firewall',
    ],
  },
  {
    name: 'Testing & QA',
    keywords: [
      'Jest', 'Mocha', 'Chai', 'Cypress', 'Playwright', 'Selenium',
      'Puppeteer', 'JUnit', 'TestNG', 'PyTest', 'Vitest',
      'React Testing Library', 'Enzyme', 'Postman', 'API Testing',
      'Load Testing', 'JMeter', 'Gatling', 'BDD', 'TDD',
      'Performance Testing', 'Manual Testing', 'Automation Testing',
      'Appium', 'Robot Framework',
    ],
  },
  {
    name: 'Blockchain & Web3',
    keywords: [
      'Blockchain', 'Solidity', 'Ethereum', 'Smart Contracts', 'Web3.js',
      'Ethers.js', 'Hardhat', 'Truffle', 'DeFi', 'NFT',
      'IPFS', 'Polygon', 'Solana', 'Rust (Solana)', 'Hyperledger',
    ],
  },
  {
    name: 'Design & UI/UX',
    keywords: [
      'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'InVision',
      'Prototyping', 'Wireframing', 'User Research', 'Design Systems',
      'Responsive Design', 'Accessibility', 'Motion Design', 'Adobe Photoshop',
      'Adobe Illustrator', 'Canva', 'Framer',
    ],
  },
  {
    name: 'Project Management & Tools',
    keywords: [
      'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence', 'Trello',
      'Asana', 'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN',
      'CI/CD', 'Slack', 'Microsoft Teams', 'Notion',
      'Technical Writing', 'Documentation', 'System Design',
    ],
  },
  {
    name: 'Emerging Technologies',
    keywords: [
      'IoT', 'Edge Computing', 'AR/VR', 'Unity', 'Unreal Engine',
      'Robotics', 'ROS', 'Embedded Systems', 'RTOS', 'FPGA',
      'Quantum Computing', '5G', 'Digital Twins', 'Low-Code/No-Code',
      'Microcontrollers', 'Arduino', 'Raspberry Pi',
    ],
  },
  {
    name: 'ERP & Enterprise',
    keywords: [
      'SAP', 'SAP ABAP', 'SAP Fiori', 'SAP HANA', 'Oracle ERP',
      'Salesforce', 'ServiceNow', 'Workday', 'Microsoft Dynamics',
      'SharePoint', 'Power Platform', 'Power Automate', 'Zoho',
    ],
  },
];

export const ALL_TECH_KEYWORDS: string[] = TECH_CATEGORIES.flatMap(c => c.keywords);
