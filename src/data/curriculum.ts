/**
 * Semester-wise subject catalogue.
 *
 * This is an editable template, not an authoritative university document. It
 * follows the AKTU (Dr. A.P.J. Abdul Kalam Technical University) scheme, which
 * is what every seeded college is affiliated to, using the university's own
 * code families: `BAS`/`BEE`/`BEC`/`BME`/`BCE`/`BCS` for the common first year
 * and `K**` from the third semester onward. Colleges affiliated elsewhere can
 * rename, re-code, add or remove anything from the admin control center — the
 * catalogue only decides what a branch starts with.
 *
 * Shape: `CURRICULUM[branchKey][semesterNumber] = [[subjectName, code], …]`.
 */

export type SubjectEntry = readonly [name: string, code: string];
export type SemesterMap = Readonly<Record<number, readonly SubjectEntry[]>>;

/** Shared AKTU first year. Every B.Tech branch starts with these two semesters. */
const BTECH_FIRST_YEAR: SemesterMap = {
  1: [
    ["Engineering Physics", "BAS101"],
    ["Engineering Mathematics I", "BAS103"],
    ["Fundamentals of Electrical Engineering", "BEE101"],
    ["Programming for Problem Solving", "BCS101"],
    ["Engineering Mechanics", "BME101"],
    ["Soft Skills I", "BAS105"],
  ],
  2: [
    ["Engineering Chemistry", "BAS201"],
    ["Engineering Mathematics II", "BAS203"],
    ["Fundamentals of Electronics Engineering", "BEC201"],
    ["Fundamentals of Mechanical Engineering", "BME201"],
    ["Basic Civil Engineering and Mechanics", "BCE201"],
    ["Soft Skills II", "BAS205"],
  ],
};

/** Subjects every AKTU branch carries in a given semester. */
const BTECH_COMMON: Readonly<Record<number, readonly SubjectEntry[]>> = {
  3: [
    ["Technical Communication", "KAS301"],
    ["Cyber Security", "KNC301"],
  ],
  4: [
    ["Universal Human Values and Professional Ethics", "KVE401"],
    ["Python Programming", "KNC402"],
  ],
  5: [["Constitution of India, Law and Engineering", "KNC501"]],
  6: [["Indian Tradition, Culture and Society", "KNC601"]],
  7: [["Industrial Management", "KOE073"]],
  8: [["Entrepreneurship Development", "KOE081"]],
};

function btech(branch: Readonly<Record<number, readonly SubjectEntry[]>>): SemesterMap {
  const out: Record<number, readonly SubjectEntry[]> = { ...BTECH_FIRST_YEAR };
  for (let semester = 3; semester <= 8; semester += 1) {
    out[semester] = [...(branch[semester] ?? []), ...(BTECH_COMMON[semester] ?? [])];
  }
  return out;
}

const CSE = btech({
  3: [
    ["Data Structures", "KCS301"],
    ["Computer Organization and Architecture", "KCS302"],
    ["Discrete Structures and Theory of Logic", "KCS303"],
    ["Mathematics IV", "KAS303"],
  ],
  4: [
    ["Operating Systems", "KCS401"],
    ["Theory of Automata and Formal Languages", "KCS402"],
    ["Object Oriented Programming with Java", "KCS403"],
    ["Microprocessors and Interfacing", "KEC402"],
  ],
  5: [
    ["Database Management Systems", "KCS501"],
    ["Compiler Design", "KCS502"],
    ["Design and Analysis of Algorithms", "KCS503"],
    ["Data Analytics", "KCS054"],
    ["Computer Graphics", "KCS053"],
  ],
  6: [
    ["Software Engineering", "KCS601"],
    ["Artificial Intelligence", "KCS602"],
    ["Computer Networks", "KCS603"],
    ["Machine Learning Techniques", "KCS055"],
    ["Digital Image Processing", "KCS063"],
  ],
  7: [
    ["Software Project Management", "KCS071"],
    ["Blockchain Architecture Design", "KCS072"],
    ["Cryptography and Network Security", "KCS074"],
    ["Distributed Systems", "KCS075"],
    ["Cloud Computing", "KCS713"],
  ],
  8: [
    ["Internet of Things", "KCS083"],
    ["Mobile Computing", "KCS084"],
    ["Quantum Computing", "KCS085"],
    ["Deep Learning", "KCS086"],
  ],
});

const IT = btech({
  3: [
    ["Data Structures", "KCS301"],
    ["Computer Organization and Architecture", "KCS302"],
    ["Discrete Structures and Theory of Logic", "KCS303"],
    ["Mathematics IV", "KAS303"],
  ],
  4: [
    ["Operating Systems", "KCS401"],
    ["Theory of Automata and Formal Languages", "KCS402"],
    ["Object Oriented Programming with Java", "KCS403"],
    ["Information Theory and Coding", "KIT401"],
  ],
  5: [
    ["Database Management Systems", "KCS501"],
    ["Design and Analysis of Algorithms", "KCS503"],
    ["Web Technology", "KIT501"],
    ["Data Warehousing and Data Mining", "KIT502"],
    ["Computer Graphics and Animation", "KIT503"],
  ],
  6: [
    ["Software Engineering", "KCS601"],
    ["Computer Networks", "KCS603"],
    ["Cloud Computing", "KIT601"],
    ["Big Data Analytics", "KIT602"],
    ["Information Security", "KIT603"],
  ],
  7: [
    ["Enterprise Resource Planning", "KIT071"],
    ["Service Oriented Architecture", "KIT072"],
    ["Cryptography and Network Security", "KCS074"],
    ["Mobile Application Development", "KIT073"],
    ["DevOps and Site Reliability", "KIT074"],
  ],
  8: [
    ["Internet of Things", "KCS083"],
    ["Software Testing and Quality Assurance", "KIT081"],
    ["Semantic Web and Web Services", "KIT082"],
    ["Digital Forensics", "KIT083"],
  ],
});

const AIML = btech({
  3: [
    ["Data Structures", "KCS301"],
    ["Computer Organization and Architecture", "KCS302"],
    ["Discrete Structures and Theory of Logic", "KCS303"],
    ["Statistics and Probability for Engineers", "KAS302"],
  ],
  4: [
    ["Operating Systems", "KCS401"],
    ["Object Oriented Programming with Java", "KCS403"],
    ["Introduction to Artificial Intelligence", "KAI401"],
    ["Linear Algebra for Machine Learning", "KAI402"],
  ],
  5: [
    ["Database Management Systems", "KCS501"],
    ["Design and Analysis of Algorithms", "KCS503"],
    ["Machine Learning", "KAI501"],
    ["Data Analytics and Visualisation", "KAI502"],
    ["Knowledge Representation and Reasoning", "KAI503"],
  ],
  6: [
    ["Software Engineering", "KCS601"],
    ["Computer Networks", "KCS603"],
    ["Deep Learning", "KAI601"],
    ["Natural Language Processing", "KAI602"],
    ["Computer Vision", "KAI603"],
  ],
  7: [
    ["Reinforcement Learning", "KAI701"],
    ["Generative AI and Large Language Models", "KAI702"],
    ["MLOps and Model Deployment", "KAI703"],
    ["Cryptography and Network Security", "KCS074"],
    ["Cloud Computing", "KCS713"],
  ],
  8: [
    ["Speech and Audio Processing", "KAI801"],
    ["AI Ethics, Fairness and Governance", "KAI802"],
    ["Robotics and Autonomous Systems", "KAI803"],
    ["Internet of Things", "KCS083"],
  ],
});

const DS = btech({
  3: [
    ["Data Structures", "KCS301"],
    ["Computer Organization and Architecture", "KCS302"],
    ["Discrete Structures and Theory of Logic", "KCS303"],
    ["Statistics and Probability for Engineers", "KAS302"],
  ],
  4: [
    ["Operating Systems", "KCS401"],
    ["Object Oriented Programming with Java", "KCS403"],
    ["Introduction to Data Science", "KDS401"],
    ["Exploratory Data Analysis with R", "KDS402"],
  ],
  5: [
    ["Database Management Systems", "KCS501"],
    ["Design and Analysis of Algorithms", "KCS503"],
    ["Machine Learning", "KDS501"],
    ["Data Warehousing and Data Mining", "KIT502"],
    ["Optimisation Techniques", "KDS502"],
  ],
  6: [
    ["Software Engineering", "KCS601"],
    ["Computer Networks", "KCS603"],
    ["Big Data Analytics", "KDS601"],
    ["Deep Learning", "KDS602"],
    ["Time Series and Forecasting", "KDS603"],
  ],
  7: [
    ["Data Engineering and Pipelines", "KDS701"],
    ["Business Intelligence and Analytics", "KDS702"],
    ["Natural Language Processing", "KAI602"],
    ["Cloud Computing", "KCS713"],
    ["Cryptography and Network Security", "KCS074"],
  ],
  8: [
    ["Graph Analytics and Network Science", "KDS801"],
    ["Recommender Systems", "KDS802"],
    ["Data Privacy and Governance", "KDS803"],
    ["Internet of Things", "KCS083"],
  ],
});

const ECE = btech({
  3: [
    ["Electronic Devices and Circuits", "KEC301"],
    ["Signals and Systems", "KEC302"],
    ["Network Analysis and Synthesis", "KEC303"],
    ["Mathematics IV", "KAS303"],
  ],
  4: [
    ["Digital Electronics and Logic Design", "KEC401"],
    ["Analog Circuits", "KEC402"],
    ["Electromagnetic Field Theory", "KEC403"],
    ["Electronic Measurement and Instrumentation", "KEC404"],
  ],
  5: [
    ["Digital Communication", "KEC501"],
    ["Microprocessors and Microcontrollers", "KEC502"],
    ["Control Systems", "KEC503"],
    ["Antenna and Wave Propagation", "KEC504"],
    ["Digital Signal Processing", "KEC505"],
  ],
  6: [
    ["VLSI Design", "KEC601"],
    ["Microwave and Radar Engineering", "KEC602"],
    ["Optical Fibre Communication", "KEC603"],
    ["Embedded Systems", "KEC604"],
    ["Wireless and Mobile Communication", "KEC605"],
  ],
  7: [
    ["Satellite Communication", "KEC701"],
    ["Internet of Things and Applications", "KEC702"],
    ["CMOS Analog IC Design", "KEC703"],
    ["Digital Image and Video Processing", "KEC704"],
    ["Nanoelectronics", "KEC705"],
  ],
  8: [
    ["Biomedical Instrumentation", "KEC801"],
    ["Radar and Navigational Aids", "KEC802"],
    ["Speech and Audio Signal Processing", "KEC803"],
    ["Robotics and Automation", "KEC804"],
  ],
});

const EE = btech({
  3: [
    ["Electrical Machines I", "KEE301"],
    ["Network Analysis and Synthesis", "KEE302"],
    ["Electronic Devices and Circuits", "KEE303"],
    ["Mathematics IV", "KAS303"],
  ],
  4: [
    ["Electrical Machines II", "KEE401"],
    ["Electrical Measurement and Instrumentation", "KEE402"],
    ["Power System I", "KEE403"],
    ["Digital Electronics", "KEE404"],
  ],
  5: [
    ["Power System II", "KEE501"],
    ["Control Systems", "KEE502"],
    ["Power Electronics", "KEE503"],
    ["Microprocessors and Applications", "KEE504"],
    ["Electrical Machine Design", "KEE505"],
  ],
  6: [
    ["Switchgear and Protection", "KEE601"],
    ["Electric Drives", "KEE602"],
    ["Utilisation of Electrical Energy", "KEE603"],
    ["Non-Conventional Energy Sources", "KEE604"],
    ["Digital Signal Processing", "KEE605"],
  ],
  7: [
    ["High Voltage Engineering", "KEE701"],
    ["Smart Grid Technologies", "KEE702"],
    ["Electric Vehicle Technology", "KEE703"],
    ["Power Quality and FACTS", "KEE704"],
    ["Industrial Automation and PLC", "KEE705"],
  ],
  8: [
    ["Power System Operation and Control", "KEE801"],
    ["Energy Audit and Management", "KEE802"],
    ["Advanced Control Systems", "KEE803"],
    ["Renewable Energy Integration", "KEE804"],
  ],
});

const ME = btech({
  3: [
    ["Engineering Thermodynamics", "KME301"],
    ["Mechanics of Solids", "KME302"],
    ["Manufacturing Science I", "KME303"],
    ["Mathematics IV", "KAS303"],
  ],
  4: [
    ["Fluid Mechanics and Fluid Machines", "KME401"],
    ["Materials Engineering", "KME402"],
    ["Theory of Machines", "KME403"],
    ["Manufacturing Science II", "KME404"],
  ],
  5: [
    ["Heat and Mass Transfer", "KME501"],
    ["Machine Design I", "KME502"],
    ["Applied Thermodynamics", "KME503"],
    ["Measurement and Metrology", "KME504"],
    ["Industrial Engineering", "KME505"],
  ],
  6: [
    ["Machine Design II", "KME601"],
    ["Refrigeration and Air Conditioning", "KME602"],
    ["Internal Combustion Engines", "KME603"],
    ["Computer Aided Design and Manufacturing", "KME604"],
    ["Mechanical Vibrations", "KME605"],
  ],
  7: [
    ["Automobile Engineering", "KME701"],
    ["Power Plant Engineering", "KME702"],
    ["Finite Element Methods", "KME703"],
    ["Robotics and Mechatronics", "KME704"],
    ["Additive Manufacturing", "KME705"],
  ],
  8: [
    ["Operations Research", "KME801"],
    ["Total Quality Management", "KME802"],
    ["Automation and Industry 4.0", "KME803"],
    ["Composite Materials", "KME804"],
  ],
});

const CE = btech({
  3: [
    ["Fluid Mechanics", "KCE301"],
    ["Surveying and Geomatics", "KCE302"],
    ["Building Material and Construction", "KCE303"],
    ["Mathematics IV", "KAS303"],
  ],
  4: [
    ["Mechanics of Solids", "KCE401"],
    ["Engineering Geology", "KCE402"],
    ["Hydraulics and Hydraulic Machines", "KCE403"],
    ["Concrete Technology", "KCE404"],
  ],
  5: [
    ["Structural Analysis I", "KCE501"],
    ["Geotechnical Engineering I", "KCE502"],
    ["Water Supply Engineering", "KCE503"],
    ["Transportation Engineering I", "KCE504"],
    ["Design of Concrete Structures", "KCE505"],
  ],
  6: [
    ["Structural Analysis II", "KCE601"],
    ["Geotechnical Engineering II", "KCE602"],
    ["Waste Water Engineering", "KCE603"],
    ["Design of Steel Structures", "KCE604"],
    ["Irrigation and Water Resources Engineering", "KCE605"],
  ],
  7: [
    ["Estimation, Costing and Specifications", "KCE701"],
    ["Construction Planning and Management", "KCE702"],
    ["Earthquake Resistant Design", "KCE703"],
    ["Bridge Engineering", "KCE704"],
    ["Remote Sensing and GIS", "KCE705"],
  ],
  8: [
    ["Advanced Foundation Engineering", "KCE801"],
    ["Environmental Impact Assessment", "KCE802"],
    ["Prestressed Concrete", "KCE803"],
    ["Traffic Engineering and Urban Transport", "KCE804"],
  ],
});

const MTECH_CSE: SemesterMap = {
  1: [
    ["Advanced Data Structures and Algorithms", "MCS101"],
    ["Mathematical Foundations of Computer Science", "MCS102"],
    ["Advanced Computer Architecture", "MCS103"],
    ["Research Methodology and IPR", "MRM101"],
  ],
  2: [
    ["Distributed Systems", "MCS201"],
    ["Advanced Database Systems", "MCS202"],
    ["Machine Learning and Pattern Recognition", "MCS203"],
    ["Soft Computing", "MCS204"],
  ],
  3: [
    ["Dissertation I", "MCS351"],
    ["Big Data Technologies", "MCS301"],
    ["Cloud and Edge Computing", "MCS302"],
  ],
  4: [
    ["Dissertation II", "MCS451"],
    ["Information Security and Privacy", "MCS401"],
  ],
};

const MTECH_VLSI: SemesterMap = {
  1: [
    ["CMOS Digital VLSI Design", "MEC101"],
    ["Semiconductor Device Modelling", "MEC102"],
    ["Advanced Digital Signal Processing", "MEC103"],
    ["Research Methodology and IPR", "MRM101"],
  ],
  2: [
    ["Analog VLSI Design", "MEC201"],
    ["Low Power VLSI Design", "MEC202"],
    ["VLSI Testing and Verification", "MEC203"],
    ["Embedded System Design", "MEC204"],
  ],
  3: [
    ["Dissertation I", "MEC351"],
    ["System on Chip Design", "MEC301"],
    ["MEMS and Microsystems", "MEC302"],
  ],
  4: [
    ["Dissertation II", "MEC451"],
    ["RF and Mixed Signal Design", "MEC401"],
  ],
};

const MCA: SemesterMap = {
  1: [
    ["Principles of Programming and Problem Solving", "KCA101"],
    ["Computer Organization and Architecture", "KCA102"],
    ["Discrete Mathematics", "KCA103"],
    ["Business Communication", "KCA104"],
    ["Accounting and Financial Management", "KCA105"],
  ],
  2: [
    ["Data Structures and Analysis of Algorithms", "KCA201"],
    ["Operating Systems", "KCA202"],
    ["Object Oriented Programming with Java", "KCA203"],
    ["Database Management Systems", "KCA204"],
    ["Computer Based Optimisation Techniques", "KCA205"],
  ],
  3: [
    ["Data Analytics", "KCA301"],
    ["Computer Networks", "KCA302"],
    ["Software Engineering", "KCA303"],
    ["Web Technology", "KCA304"],
    ["Artificial Intelligence", "KCA305"],
  ],
  4: [
    ["Machine Learning", "KCA401"],
    ["Cloud Computing", "KCA402"],
    ["Information Security", "KCA403"],
    ["Mobile Application Development", "KCA404"],
    ["Project", "KCA451"],
  ],
};

const MBA: SemesterMap = {
  1: [
    ["Managerial Economics", "KMB101"],
    ["Accounting and Financial Analysis", "KMB102"],
    ["Organisational Behaviour", "KMB103"],
    ["Business Statistics and Analytics", "KMB104"],
    ["Marketing Management", "KMB105"],
    ["Business Communication", "KMB106"],
  ],
  2: [
    ["Financial Management", "KMB201"],
    ["Human Resource Management", "KMB202"],
    ["Production and Operations Management", "KMB203"],
    ["Business Research Methods", "KMB204"],
    ["Business Environment and Legal Aspects", "KMB205"],
    ["Management Information Systems", "KMB206"],
  ],
  3: [
    ["Strategic Management", "KMB301"],
    ["Entrepreneurship Development", "KMB302"],
    ["Consumer Behaviour", "KMB303"],
    ["Security Analysis and Portfolio Management", "KMB304"],
    ["Compensation and Reward Management", "KMB305"],
  ],
  4: [
    ["International Business Management", "KMB401"],
    ["Business Analytics", "KMB402"],
    ["Digital and Social Media Marketing", "KMB403"],
    ["Corporate Governance and Ethics", "KMB404"],
    ["Dissertation", "KMB451"],
  ],
};

const BCA: SemesterMap = {
  1: [
    ["Fundamentals of Information Technology", "BCA101"],
    ["Programming in C", "BCA102"],
    ["Mathematics I", "BCA103"],
    ["Digital Electronics", "BCA104"],
    ["Communication Skills", "BCA105"],
  ],
  2: [
    ["Data Structures using C", "BCA201"],
    ["Object Oriented Programming with C++", "BCA202"],
    ["Mathematics II", "BCA203"],
    ["Computer Organization", "BCA204"],
    ["Environmental Studies", "BCA205"],
  ],
  3: [
    ["Database Management Systems", "BCA301"],
    ["Operating Systems", "BCA302"],
    ["Java Programming", "BCA303"],
    ["Discrete Mathematics", "BCA304"],
    ["Financial Accounting", "BCA305"],
  ],
  4: [
    ["Computer Networks", "BCA401"],
    ["Web Technologies", "BCA402"],
    ["Software Engineering", "BCA403"],
    ["Python Programming", "BCA404"],
    ["Numerical Methods", "BCA405"],
  ],
  5: [
    ["Design and Analysis of Algorithms", "BCA501"],
    ["Data Warehousing and Mining", "BCA502"],
    ["Mobile Application Development", "BCA503"],
    ["Cyber Security", "BCA504"],
    ["Cloud Computing", "BCA505"],
  ],
  6: [
    ["Machine Learning Basics", "BCA601"],
    ["Internet of Things", "BCA602"],
    ["Enterprise Resource Planning", "BCA603"],
    ["Project Work", "BCA651"],
  ],
};

const BBA: SemesterMap = {
  1: [
    ["Principles of Management", "BBA101"],
    ["Business Economics", "BBA102"],
    ["Financial Accounting", "BBA103"],
    ["Business Mathematics", "BBA104"],
    ["Business Communication", "BBA105"],
  ],
  2: [
    ["Organisational Behaviour", "BBA201"],
    ["Business Statistics", "BBA202"],
    ["Cost Accounting", "BBA203"],
    ["Business Environment", "BBA204"],
    ["Computer Applications in Business", "BBA205"],
  ],
  3: [
    ["Marketing Management", "BBA301"],
    ["Human Resource Management", "BBA302"],
    ["Financial Management", "BBA303"],
    ["Business Law", "BBA304"],
    ["Operations Management", "BBA305"],
  ],
  4: [
    ["Consumer Behaviour", "BBA401"],
    ["Income Tax Law and Practice", "BBA402"],
    ["Management Accounting", "BBA403"],
    ["Entrepreneurship Development", "BBA404"],
    ["Research Methodology", "BBA405"],
  ],
  5: [
    ["Strategic Management", "BBA501"],
    ["International Business", "BBA502"],
    ["Digital Marketing", "BBA503"],
    ["Banking and Insurance", "BBA504"],
    ["Business Analytics", "BBA505"],
  ],
  6: [
    ["Corporate Governance and Ethics", "BBA601"],
    ["Supply Chain Management", "BBA602"],
    ["Project Management", "BBA603"],
    ["Project Work", "BBA651"],
  ],
};

/** Every branch the catalogue knows about, keyed `programSlug:branchCode`. */
export const CURRICULUM: Readonly<Record<string, SemesterMap>> = {
  "btech:CSE": CSE,
  "btech:IT": IT,
  "btech:AIML": AIML,
  "btech:DS": DS,
  "btech:ECE": ECE,
  "btech:EE": EE,
  "btech:ME": ME,
  "btech:CE": CE,
  "mtech:CSE": MTECH_CSE,
  "mtech:VLSI": MTECH_VLSI,
  "mca:MCA": MCA,
  "mba:MBA": MBA,
  "bca:BCA": BCA,
  "bba:BBA": BBA,
};

export function curriculumKey(programSlug: string, branchCode: string) {
  return `${programSlug}:${branchCode.toUpperCase()}`;
}

/** Catalogue entry for a branch, or null when nothing is templated for it. */
export function curriculumFor(programSlug: string, branchCode: string): SemesterMap | null {
  return CURRICULUM[curriculumKey(programSlug, branchCode)] ?? null;
}

export function curriculumSubjectCount(map: SemesterMap) {
  return Object.values(map).reduce((total, list) => total + list.length, 0);
}

/** Flat `{ semester, name, code }` rows, ordered by semester then name. */
export function curriculumRows(map: SemesterMap) {
  return Object.entries(map)
    .flatMap(([semester, list]) =>
      list.map(([name, code]) => ({ semester: Number(semester), name, code })),
    )
    .sort((a, b) => a.semester - b.semester || a.name.localeCompare(b.name));
}
