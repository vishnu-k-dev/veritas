// Constants for the AI Screening Engine

// Question templates - STAR method focused, anti-cheat questions
// These prompt Situation, Task, Action, Result answers that cannot be Googled
export const QUESTION_TEMPLATES = {
  experience: [
    "Tell me about a specific project where you used {skill}. What was the situation, what did YOU do, and what was the measurable outcome?",
    "Walk me through a real challenge you faced with {skill}. What was the problem, how did you approach it, and what did you achieve?",
    "Describe a time you implemented {skill} from scratch. What was the context, your exact approach, and what results did it produce?",
    "Share a story where your {skill} work made a significant impact. What was the starting situation, your actions, and the final metrics?",
    "Give me a concrete example of using {skill} in production. What was at stake, what did you build, and how did it perform?",
  ],

  depth: [
    "When you faced a performance issue with {skill}, walk me through your debugging process step-by-step. What tools did you use?",
    "Tell me about a {skill} architecture decision you made. What alternatives did you evaluate and why did you choose your approach?",
    "Describe a time you optimized {skill} code. What metrics did you improve and by how much?",
    "How do you typically test your {skill} code? Give me a real example with specific testing strategies you used.",
  ],

  collaboration: [
    "Tell me about a disagreement you had with a teammate about {skill}. What was the situation, how did you handle it, and what was the outcome?",
    "Describe a time you mentored someone on {skill}. What was challenging, and how did you measure their improvement?",
  ],

  failure: [
    "Tell me about a time your {skill} code caused a production incident. What happened, how did you fix it, and what did you learn?",
    "Share a {skill} project that didn't go as planned. What went wrong, what actions did you take, and what would you do differently?",
    "Describe your worst debugging experience with {skill}. What made it difficult, and how did you eventually solve it?",
  ],
};


// Follow-up question templates - context-aware for any skill type
export const FOLLOWUP_TEMPLATES = {
  specificity: [
    "Can you walk me through a specific example of how you applied this?",
    "What were the measurable results or outcomes from that experience?",
    "Can you describe a particular situation where you used {skill} in detail?",
    "What specific challenges did you face and how did you overcome them?",
  ],

  depth: [
    "How did you know that was the right approach?",
    "What alternatives did you consider before choosing that solution?",
    "What would you do differently if you faced this situation again?",
    "What did you learn from that experience that you still apply today?",
  ],

  consistency: [
    "You mentioned {detail} - can you elaborate on that?",
    "That's interesting. How does this connect to your overall experience with {skill}?",
    "Can you tell me more about {detail} and how it impacted the outcome?",
  ],

  // Contextual follow-ups based on answer content
  contextual: [
    "You mentioned {topic} - can you share more about your role in that?",
    "Tell me more about the {topic} aspect. What was your specific contribution?",
    "That's interesting about {topic}. What were the key lessons from that experience?",
    "Can you elaborate on how {topic} helped you achieve results?",
  ],
};

// Red flag patterns for authenticity detection
export const RED_FLAG_PATTERNS = {
  generic: [
    "in general",
    "typically",
    "usually we would",
    "best practice is",
    "the standard approach",
    "most developers",
    "it depends on",
  ],

  textbook: [
    "is defined as",
    "refers to",
    "is a concept",
    "is a technique",
    "is used for",
    "allows developers to",
  ],

  overlyPolished: [
    "seamlessly",
    "flawlessly",
    "perfectly",
    "without any issues",
    "everything worked as expected",
  ],
};

// Authenticity scoring weights
export const AUTHENTICITY_WEIGHTS = {
  personalContext: 25,      // Use of "I", "my", "we", "our team"
  specificDetails: 25,      // Exact errors, code snippets, tool names
  imperfectNarrative: 20,   // Admits confusion, mistakes, learning
  depthConsistency: 20,     // Answers align in complexity
  naturalLanguage: 10,      // Not overly polished
};

// Skill categories
export const SKILL_CATEGORIES = {
  programming: [
    "javascript", "python", "java", "c++", "c#", "typescript", "go", "rust", "ruby", "php",
    "swift", "kotlin", "scala", "r", "matlab", "perl", "bash", "powershell", "sql"
  ],
  frameworks: [
    "react", "angular", "vue", "node.js", "express", "django", "flask", "spring", "rails",
    "next.js", "nuxt", "svelte", "fastapi", "nest.js", ".net", "laravel"
  ],
  databases: [
    "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "cassandra", "dynamodb",
    "firebase", "sql server", "oracle", "sqlite"
  ],
  cloud: [
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible", "jenkins",
    "github actions", "gitlab ci", "circleci"
  ],
  tools: [
    "git", "jira", "confluence", "slack", "figma", "postman", "swagger", "graphql",
    "rest api", "microservices", "agile", "scrum"
  ],
  data: [
    "machine learning", "deep learning", "tensorflow", "pytorch", "pandas", "numpy",
    "scikit-learn", "data analysis", "statistics", "big data", "spark", "hadoop"
  ],
};

// Skill aliases for fuzzy matching
export const SKILL_ALIASES = {
  // JavaScript ecosystem
  "react": ["reactjs", "react.js", "react js"],
  "node.js": ["nodejs", "node", "node js"],
  "next.js": ["nextjs", "next"],
  "vue": ["vuejs", "vue.js", "vue js"],
  "angular": ["angularjs", "angular.js"],
  "express": ["expressjs", "express.js"],
  "typescript": ["ts"],
  "javascript": ["js", "ecmascript", "es6", "es2015"],

  // Python ecosystem
  "python": ["python3", "py"],
  "django": ["djangorest", "drf"],
  "flask": ["flaskapi"],
  "pandas": ["pd"],
  "numpy": ["np"],

  // Databases
  "postgresql": ["postgres", "psql", "pg"],
  "mongodb": ["mongo"],
  "mysql": ["mariadb"],
  "redis": ["redisdb"],
  "sql server": ["mssql", "tsql", "t-sql"],

  // Cloud & DevOps
  "aws": ["amazon web services", "amazon aws"],
  "azure": ["microsoft azure", "azure cloud"],
  "gcp": ["google cloud", "google cloud platform"],
  "kubernetes": ["k8s", "kube"],
  "docker": ["dockerfile", "containers"],
  "terraform": ["tf", "terragrunt"],
  "ci/cd": ["cicd", "continuous integration", "continuous deployment"],
  "github actions": ["gh actions", "gha"],

  // General
  "machine learning": ["ml", "ai", "artificial intelligence"],
  "deep learning": ["dl", "neural networks"],
  "rest api": ["restful", "rest apis", "restful api"],
  "graphql": ["gql"],
  "microservices": ["micro services", "micro-services"],
  "agile": ["agile methodology", "scrum", "kanban"],
};

// Skill Clusters - Related skills that imply each other
// When a skill is found, related skills can be inferred
export const SKILL_CLUSTERS = {
  // Frontend frameworks imply their base languages
  "react": { implies: ["javascript", "frontend", "jsx", "html", "css"], category: "frontend" },
  "angular": { implies: ["typescript", "javascript", "frontend", "html", "css"], category: "frontend" },
  "vue": { implies: ["javascript", "frontend", "html", "css"], category: "frontend" },
  "next.js": { implies: ["react", "javascript", "node.js", "frontend"], category: "fullstack" },
  "svelte": { implies: ["javascript", "frontend", "html", "css"], category: "frontend" },

  // Backend frameworks imply their languages
  "express": { implies: ["node.js", "javascript", "backend", "rest api"], category: "backend" },
  "django": { implies: ["python", "backend", "rest api"], category: "backend" },
  "flask": { implies: ["python", "backend", "rest api"], category: "backend" },
  "spring": { implies: ["java", "backend", "rest api"], category: "backend" },
  "rails": { implies: ["ruby", "backend", "rest api"], category: "backend" },
  "fastapi": { implies: ["python", "backend", "rest api"], category: "backend" },

  // Databases imply SQL/NoSQL knowledge
  "postgresql": { implies: ["sql", "databases", "backend"], category: "database" },
  "mysql": { implies: ["sql", "databases", "backend"], category: "database" },
  "mongodb": { implies: ["nosql", "databases", "backend"], category: "database" },
  "redis": { implies: ["caching", "databases", "backend"], category: "database" },

  // Cloud platforms imply DevOps
  "aws": { implies: ["cloud", "devops", "infrastructure"], category: "cloud" },
  "azure": { implies: ["cloud", "devops", "infrastructure"], category: "cloud" },
  "gcp": { implies: ["cloud", "devops", "infrastructure"], category: "cloud" },
  "kubernetes": { implies: ["docker", "devops", "containers", "orchestration"], category: "devops" },
  "docker": { implies: ["containers", "devops"], category: "devops" },

  // Data science stack
  "tensorflow": { implies: ["python", "machine learning", "deep learning"], category: "data" },
  "pytorch": { implies: ["python", "machine learning", "deep learning"], category: "data" },
  "pandas": { implies: ["python", "data analysis"], category: "data" },
  "scikit-learn": { implies: ["python", "machine learning"], category: "data" },
};

// Experience level definitions
export const EXPERIENCE_LEVELS = {
  entry: { label: "Entry Level (0-2 years)", min: 0, max: 2 },
  junior: { label: "Junior (2-4 years)", min: 2, max: 4 },
  mid: { label: "Mid-Level (4-6 years)", min: 4, max: 6 },
  senior: { label: "Senior (6-10 years)", min: 6, max: 10 },
  lead: { label: "Lead/Staff (10+ years)", min: 10, max: 99 },
};

// Evaluation thresholds
export const EVALUATION_THRESHOLDS = {
  pass: {
    skillMatch: 60,
    authenticity: 55,
    overall: 60,
  },
  hold: {
    skillMatch: 40,
    authenticity: 40,
    overall: 40,
  },
  // Below hold thresholds = reject
};

// Decision reasons templates
export const DECISION_REASONS = {
  pass: [
    "Strong alignment with required skills",
    "Demonstrated real-world experience",
    "Consistent depth across answers",
    "Clear understanding of trade-offs",
    "Good problem-solving approach",
  ],
  hold: [
    "Partial skill match - needs further evaluation",
    "Some answers lacked specificity",
    "Experience level needs verification",
    "Good potential but gaps in key areas",
  ],
  reject: [
    "Significant skill gaps for this role",
    "Answers lacked concrete examples",
    "Experience doesn't align with requirements",
    "Unable to demonstrate practical knowledge",
  ],
};

// Improvement suggestions by skill category
export const IMPROVEMENT_SUGGESTIONS = {
  programming: [
    "Build 2-3 personal projects using {skill} to gain hands-on experience",
    "Contribute to open source projects that use {skill}",
    "Practice coding challenges on LeetCode or HackerRank focusing on {skill}",
  ],
  frameworks: [
    "Complete an official tutorial or certification for {skill}",
    "Build a full-stack application using {skill}",
    "Study the internal architecture of {skill} to understand it deeply",
  ],
  databases: [
    "Set up a local {skill} instance and practice complex queries",
    "Learn about indexing, optimization, and scaling with {skill}",
    "Build a project that requires advanced {skill} features",
  ],
  cloud: [
    "Complete AWS/Azure/GCP free tier projects using {skill}",
    "Get certified in {skill} fundamentals",
    "Practice deploying real applications using {skill}",
  ],
  general: [
    "Document your learning journey and projects on a blog or portfolio",
    "Practice explaining technical concepts in simple terms",
    "Participate in code reviews to improve your skills",
  ],
};

// Alternative roles mapping
export const ALTERNATIVE_ROLES = {
  "frontend developer": ["ui developer", "react developer", "web developer"],
  "backend developer": ["api developer", "node.js developer", "python developer"],
  "full stack developer": ["software engineer", "web developer", "application developer"],
  "data scientist": ["data analyst", "ml engineer", "business analyst"],
  "devops engineer": ["site reliability engineer", "cloud engineer", "platform engineer"],
  "mobile developer": ["ios developer", "android developer", "flutter developer"],
};
