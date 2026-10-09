/**
 * Term-I review templates and their question sets (SPEC.md B8, seeded exactly).
 * Term-II sets arrive with F13. `reviewType` is unique; `order` is the logbook
 * sequence. None of the Term-I sheets has a Date column.
 */
export type ReviewSeedTemplate = {
  term: "TERM_I" | "TERM_II";
  reviewType:
    | "REVIEW_I"
    | "REVIEW_II"
    | "FINAL_DESIGN"
    | "REVIEW_I_MODELING"
    | "REVIEW_II_CODING"
    | "FINAL_VALIDATION"
    | "REPORT_WRITING";
  title: string;
  order: number;
  hasDateColumn: boolean;
  questions: string[];
};

export const REVIEW_SEED: readonly ReviewSeedTemplate[] = [
  {
    term: "TERM_I",
    reviewType: "REVIEW_I",
    title: "Term-I Review I (Problem Statement, Motivation, Objectives and Literature Review)",
    order: 1,
    hasDateColumn: false,
    questions: [
      "Does the statement give clear identification about what your project will accomplish?",
      "Is the statement short and concise?",
      "Can a person who is not familiar with the project understand the scope of the project by reading the problem statement?",
      "The project's objectives of study (what product, process, resource etc.) are being addressed?",
      "Is similar type of methodology / model used for existing work?",
      "Is the studied literature sufficient to decide the scope of the project?",
      "Are the objectives set going to help achieve the goal of the project?",
      "Does the research gap identified lead to find the motivation of the project?",
      "Does your project contribute to our society by any means and lead to find motivation?",
      "Are the objectives clearly and unambiguously listed?",
    ],
  },
  {
    term: "TERM_I",
    reviewType: "REVIEW_II",
    title: "Term-I Review II (Feasibility and Scope)",
    order: 2,
    hasDateColumn: false,
    questions: [
      "Is the project's viewpoint understood?",
      "Is the project goal statement in alignment with the sponsoring organization's business goal and mission?",
      "Who is the project's end user?",
      "What is the projected cost of producing a product?",
      "Is the project achievable in the specified (Time, Cost, Budget)?",
      "Are the requirements within the scope of the project?",
      "Is the scope properly defined?",
      "Does the problem statement clearly define the scope of the project?",
      "Do the project requirements fit into available software and hardware?",
      "Whether the milestones are stated completely and project timeline is given?",
      "Whether risks like technical, operational, schedule and business risks are identified correctly or not?",
      "Whether risk prioritization is done properly or not and any backup plan is there or not?",
    ],
  },
  {
    term: "TERM_I",
    reviewType: "FINAL_DESIGN",
    title: "Term-I Final Review / Mock Evaluation (Design)",
    order: 3,
    hasDateColumn: false,
    questions: [
      "Are requirements reflected in the system architecture?",
      "Does the design support both project (product) and project goals?",
      "Does the design address all the issues from the requirement?",
      "Is effective modularity achieved and are modules functionally independent?",
      "Are structural diagrams (class, object, etc.) well defined?",
      "Are all class associations clearly defined and understood? (Is it clear which classes provide which services?)",
      "Are the classes in the class diagram clear? (What they represent in the architecture design document?)",
      "Is inheritance appropriately used?",
      "Are the multiplicities in the use case diagram depicted in the class diagram?",
      "Are all objects used in the sequence diagram?",
      "Are the symbols used in all diagrams corresponding to UML standards?",
      "Are behavioral diagrams (use case, sequence, activity, etc.) well defined and understood?",
      "Does each case have clearly defined actors and input/output?",
      "Does the sequence diagram match with the class diagram?",
      "Is aggregation / containment (used) clearly defined and understood?",
      "Whether State charts are capturing the system's dynamic behavior correctly or not?",
      "Related to procedural thinking, whether DFDs and CFDs along with transaction and transformation flow are done correctly or not?",
    ],
  },
  {
    term: "TERM_II",
    reviewType: "REVIEW_I_MODELING",
    title: "Term-II Review I (Modeling: Model Refinement and Algorithm Development)",
    order: 4,
    hasDateColumn: false,
    questions: [
      "Which software development process model is used? (Waterfall, Incremental, RAD) How?",
      "Do you clearly identify data objects, their attributes and relationships? (All constraints from SRS captured or not?)",
      "Have you clearly matched the objects with respective classes and their responsibilities?",
      "Have you analyzed the requirements and represented them into respective models?",
      "Can you differentiate between different system states and depict them in the form of a state transition diagram?",
      "Does the mathematical model clearly imply the design of the project?",
      "Does the mathematical model clearly state the goal of the project?",
      "Does the interface between the modules properly identified?",
      "Are any functional dependencies identified and described?",
      "Which architectural model does your system support?",
      "Whether the Deployment diagram is in line with the selected architecture?",
      "Whether all components are designed properly and represented in the component diagram?",
      "Whether NP-completeness of algorithms is checked or not?",
    ],
  },
  {
    term: "TERM_II",
    reviewType: "REVIEW_II_CODING",
    title: "Term-II Review II (Coding / Implementation)",
    order: 5,
    hasDateColumn: true,
    questions: [
      "Does the code completely and correctly implement the design?",
      "Does the code comply with the coding standard?",
      "Is the code well structured, consistent in style and consistently formatted?",
      "Are all functions in the design coded?",
      "Does the code make use of object oriented concepts?",
      "Does the code support granularity?",
      "Is the language used for coding correctly chosen as per the project need?",
      "If any off-the-shelf components are used, have you understood the functionalities of using it?",
      "Are all comments consistent with the code?",
      "Whether code optimization is done properly or not? (By using language features)",
    ],
  },
  {
    term: "TERM_II",
    reviewType: "FINAL_VALIDATION",
    title: "Term-II Final Review (Validation and Testing)",
    order: 6,
    hasDateColumn: true,
    questions: [
      "Have you done alpha testing?",
      "Have you done beta testing?",
      "Have you validated the requirements, design and code as per standard?",
      "Have you performed GUI testing of the project? How?",
      "Does your system comply with basic usability norms?",
      "Have you tested the code using standard datasets available in your area of project?",
      "Have you tested the code in a real time environment?",
      "After integration of all components, whether total performance of the system is checked or not?",
      "Whether the repository of all components along with versions is documented or not?",
    ],
  },
  {
    term: "TERM_II",
    reviewType: "REPORT_WRITING",
    title: "Term-II Report Writing Review",
    order: 7,
    hasDateColumn: true,
    questions: [
      "Is the report written as per the prescribed format?",
      "Is the report timely prepared?",
      "Is the report properly organized, spelled and grammatically correct?",
      "Is the report plagiarism free?",
      "Is the report precise and written to the point?",
      "Does the report contain complete results and comparative graphs?",
      "Are all figures and tables properly numbered and labeled?",
      "Are all figures and tables properly cited?",
      "Whether references are properly cited?",
    ],
  },
];
