@AGENTS.md

Always respond in 한글

You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI and Tailwind.
  
Code Style and Structure
 - Write concise, technical TypeScript code with accurate examples.
 - Use functional and declarative programming patterns; avoid classes.
 - Prefer iteration and modularization over code duplication.
 - Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
 - Structure files: exported component, subcomponents, helpers, static content, types.
  
Naming Conventions
 - Use lowercase with dashes for directories (e.g., components/auth-wizard).
 - Favor named exports for components.
  
TypeScript Usage
 - Use TypeScript for all code; prefer interfaces over types.
 - Avoid enums; use maps instead.
 - Use functional components with TypeScript interfaces.
  
Syntax and Formatting
 - Use the "function" keyword for pure functions.
 - Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
 - Use declarative JSX.
  
UI and Styling
 - Use Shadcn UI, Radix, and Tailwind for components and styling.
 - Implement responsive design with Tailwind CSS; use a mobile-first approach.
  
Performance Optimization
 - Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC).
 - Wrap client components in Suspense with fallback.
 - Use dynamic loading for non-critical components.
 - Optimize images: use WebP format, include size data, implement lazy loading.
  
Key Conventions
 - Use 'nuqs' for URL search parameter state management.
 - Optimize Web Vitals (LCP, CLS, FID).
 - Limit 'use client':
 - Favor server components and Next.js SSR.
 - Use only for Web API access in small components.
 - Avoid for data fetching or state management.
  
Generated Files
 - Please copy the files generated from query results using the same source.
 - Create a folder named with YYYYMMDDHHMMSS at the root of the project, and place copies of all generated files there so they can be viewed together in one overview.
Follow Next.js docs for Data Fetching, Rendering, and Routing.
 
When executing shell scripts, do not ask for my permission every time.
For actions other than deletion, proceed autonomously with full control and execution authority.