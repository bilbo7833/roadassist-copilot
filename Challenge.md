# Candidate Case Study: Insurance Co-Pilot

## Objective

This take-home exercise assesses your ability to design and communicate a technical vision, lead the delivery of a solution, make technical trade-offs, and document your approach. We want to see your ability to align technical decisions with business impact while managing complexity and delivery.

## Scenario

We are working with a leading car insurance company to help them build an agent that supports human agents answering roadside assistance requests (e.g. cars of clients breaking down). Assume you have a demo with the client tomorrow. Your task is to design and build a basic prototype of an AI-powered agent that increases efficiency and accuracy vs. the current workflow.

### Existing workflow

Assume this happens **before** our solution:

- **Human data gathering:** Human agent talks to client on the phone in order to get all relevant information (name, car, location, type of damage, current client situation).
- **Manual coverage check:** Human agent looks up if the scenario described by the client is covered by their policy.
- **Next best action:** Human agent manually finds a suitable garage and next best action (either tow truck or repair truck).
- **Client updates:** While on the phone, human agent updates the client with the next steps.

### Target automated flow

This is the flow we want to automate:

- **Voice agent data gathering:** Client talks to voice agent (can be laptop; does not need to be phone). Voice agent gathers all relevant information from the client.
- **Automated coverage check:** After the voice agent conversation, the AI agent takes the information and compares it against the relevant client policy documents to decide if the case is covered.
- **Next best action:** If covered, the AI agent identifies what to do in this case, finds the closest possible garage, and decides whether a tow or repair truck should be sent.
- **Client updates:** AI agent sends a notification to the customer (can be a fake SMS in a web app) to update them on what was assessed and what will happen next.

### After our solution

Assume this happens **after** our solution:

- **Dispatch:**
  - Repair / tow truck would be dispatched.
  - Dispatch taxi / reserve rental car.

## Your task

### 1. Prototype

- Using an AI coding tool (e.g. Replit, Lovable, Cursor, …), create a functional prototype demonstrating the core user flow for an insurance copilot.
- The prototype should include:
  - A basic user interface for initiating a claim.
  - Voice agent conversation.
  - UI to observe the agent for humans.
  - Leverage AI functionality in the best possible way in this claims process.
- **Data:** Take assumptions; generate synthetic data where needed.
- **Vision:** How would you present and pitch this to the customer? How would it allow them to revolutionize their business?
- Provide a link to a GitHub repo of the prototype as well as a recorded demo.

### 2. Product Requirements Document (PRD)

Write a concise PRD (**2 pages hard maximum**) covering the following:

- **Vision:** Briefly describe the product vision and goals.
- **Key features:** List and describe the essential features of your AI-powered claims solution.
- **Prioritization:** Explain your prioritization rationale for the features included.
- **Milestones:** When building this for real, how would you approach it and split up the work?
- **Technical risks:** What will be the key challenges to roll this out in production?
- **AI integration:** Briefly describe the high-level approach you would take to perform damage assessment using AI models.

## Deliverables

- A link to your functional prototype or a recorded demo with GitHub repo.
- A PDF / Google Doc of your PRD (2 pages maximum).

## Evaluation criteria

### Prototype

- Functionality and user flow.
- Effective use of the AI coding tool.
- Demonstration of AI integration.
- Prioritization decisions.

### PRD

- Clarity and conciseness of writing.
- Alignment with the prototype design.
- Strong analytical thinking and prioritization.
- How AI is thoughtfully incorporated into the product, including the human–AI interaction.

### Presentation

- You will walk us through your PRD/prototype in a live interview.
- While it is ok (and encouraged) to use AI to accomplish the assignment, make sure you can back up every decision.

## Final notes

This is an intentionally vague assignment. We want to see how you scope a vague project and lead our customers when they themselves may not know all the features they need.

## Time allotment

- Please do not spend more than **5–6 hours** on this project.
- We understand this is an ambitious project in the time allotted.
  - Please do **not** spend more time building additional features outside the core workflow. Focus on making the features you build thoughtful and solving the user’s problem.
  - If there are additional features you think would be useful but do not have time to build, write about them in the PRD.
  - Please do **not** worry about UI polish (how it looks); focus on UX (how it works).
  - Please do **not** submit a PRD longer than 2 pages. Brevity is the soul of wit.
