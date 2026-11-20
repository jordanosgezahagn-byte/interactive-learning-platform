const topicGroups = {
  'HTML & CSS': [
    ['Page structure', 'Semantic elements', 'Headings and paragraphs', 'Links and images'],
    ['Forms and content', 'Lists and tables', 'Forms and labels', 'Accessible input feedback'],
    ['CSS foundations', 'Selectors and cascade', 'Colors and typography', 'Box model and spacing'],
    ['Page layout', 'Flexbox alignment', 'CSS Grid areas', 'Responsive breakpoints'],
    ['Polished interfaces', 'Reusable component styles', 'Focus and keyboard states', 'Responsive page project'],
  ],
  JavaScript: [
    ['Language foundations', 'Values and variables', 'Types and operators', 'Conditions and boolean logic'],
    ['Reusable logic', 'Loops and iteration', 'Functions and parameters', 'Scope and return values'],
    ['Working with data', 'Arrays and methods', 'Objects and properties', 'Destructuring and spread'],
    ['Interactive pages', 'Selecting DOM elements', 'Events and handlers', 'Form input and validation'],
    ['Reliable applications', 'Promises and async/await', 'Errors and debugging', 'JSON and local storage'],
  ],
  Python: [
    ['Python foundations', 'Variables and basic types', 'Strings and formatting', 'Input and output'],
    ['Program flow', 'Conditions and comparisons', 'For and while loops', 'Functions and return values'],
    ['Collections', 'Lists and slicing', 'Dictionaries and sets', 'Tuples and unpacking'],
    ['Organized programs', 'Modules and imports', 'Classes and objects', 'Methods and inheritance'],
    ['Practical Python', 'Reading and writing files', 'Exceptions and validation', 'Build a command-line tool'],
  ],
  PHP: [
    ['PHP foundations', 'PHP tags and output', 'Variables and data types', 'Strings and arrays'],
    ['Program logic', 'Conditions and comparisons', 'Loops and iteration', 'Functions and scope'],
    ['Web requests', 'Forms and request methods', 'Validation and safe output', 'Sessions and state'],
    ['Data persistence', 'PDO database connections', 'Prepared statements', 'Create, read, update, delete'],
    ['Secure applications', 'Password hashing', 'Authorization checks', 'Build a small PHP feature'],
  ],
  MySQL: [
    ['Relational foundations', 'Tables, rows, and keys', 'Column types and constraints', 'Relationships and foreign keys'],
    ['Querying data', 'SELECT and aliases', 'WHERE and sorting', 'Pagination and distinct results'],
    ['Changing data', 'INSERT rows', 'UPDATE safely', 'DELETE and referential integrity'],
    ['Combining results', 'INNER and LEFT JOIN', 'Grouping and aggregates', 'Subqueries'],
    ['Reliable databases', 'Indexes and query plans', 'Transactions and rollback', 'Normalize a small schema'],
  ],
  'Data Structures': [
    ['Sequence structures', 'Arrays and dynamic arrays', 'Singly linked lists', 'Doubly linked lists'],
    ['Ordered access', 'Stacks and LIFO', 'Queues and FIFO', 'Deques and priority queues'],
    ['Fast lookup', 'Hash maps and collisions', 'Sets and membership', 'Binary search trees'],
    ['Hierarchies and networks', 'Tree traversals', 'Heaps and priority', 'Graphs and adjacency lists'],
    ['Algorithms in practice', 'Linear and binary search', 'Sorting strategies', 'Big O and trade-offs'],
  ],
};

export const starterCourseLessonLimit = 6;

export const starterCatalog = Object.entries(topicGroups).map(([title, groups]) => ({
  title,
  description: `A hands-on introduction to ${title}, with guided lessons, practical exercises, and knowledge checks.`,
  difficulty: 'beginner',
  estimatedMinutes: 450,
  groups: groups.map(([moduleTitle, ...lessons]) => ({ moduleTitle, lessons })),
}));

export function getStarterLessonTitles(courseTitle) {
  return starterCatalog.find((course) => course.title === courseTitle)?.groups
    .flatMap((group) => group.lessons)
    .slice(0, starterCourseLessonLimit) ?? [];
}

const examples = {
  'HTML & CSS': [
    '<main class="card"><h1>Welcome</h1><p>A clear page starts with meaningful structure.</p></main>\n<style>.card { max-width: 32rem; margin: 2rem auto; padding: 1.5rem; font-family: system-ui; }</style>',
    '<article><h1>Page title</h1><h2>Section title</h2><p>Group related content in a section.</p></article>',
    '<a href="https://example.com">Read more</a>\n<img src="photo.jpg" alt="A clear description of the image">',
    '<label for="email">Email address</label>\n<input id="email" type="email" required>',
    '<style>h1 { color: #285d48; }\n.card { padding: 1rem; border-radius: .75rem; }</style>\n<article class="card"><h1>Styled card</h1></article>',
    '<style>.layout { display: flex; gap: 1rem; align-items: center; }</style>\n<div class="layout"><span>One</span><span>Two</span></div>',
    '<style>.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }</style>\n<div class="grid"><article>Learn</article><article>Practice</article></div>',
    '<style>.card { padding: 1rem; } @media (max-width: 600px) { .card { padding: .5rem; } }</style>\n<article class="card">Adapts to screen size</article>',
    '<button type="button">Save changes</button>\n<style>button:focus-visible { outline: 3px solid #df9b37; outline-offset: 3px; }</style>',
    '<form><label for="name">Name</label><input id="name" required><button>Continue</button></form>',
    '<nav aria-label="Main navigation"><a href="#lessons">Lessons</a></nav>',
    '<main><h1>Course notes</h1><p>Use semantic HTML and readable styles.</p></main>',
    '<style>.stack > * + * { margin-top: 1rem; }</style><section class="stack"><h2>Title</h2><p>Content</p></section>',
    '<style>.page { width: min(100% - 2rem, 70rem); margin-inline: auto; }</style><main class="page">Responsive content</main>',
    '<main><h1>My learning page</h1><p>Build a useful, accessible page.</p><a href="#start">Get started</a></main>',
  ],
  JavaScript: [
    'const learner = "Sam";\nconst minutes = 20;\nconsole.log(`${learner} studied for ${minutes} minutes`);',
    'const score = 82;\nconst passed = score >= 70;\nconsole.log(passed);',
    'const lessons = ["HTML", "CSS", "JavaScript"];\nfor (const lesson of lessons) console.log(lesson);',
    'function add(a, b) { return a + b; }\nconsole.log(add(3, 4));',
    'const prices = [12, 18, 25];\nconst discounted = prices.map((price) => price * 0.9);\nconsole.log(discounted);',
    'const course = { title: "JavaScript", lessons: 15 };\nconsole.log(course.title);',
    'const learner = { name: "Sam", active: true };\nconst { name, ...details } = learner;\nconsole.log(name, details);',
    'const button = document.querySelector("button");\nbutton.textContent = "Start learning";',
    'document.querySelector("button").addEventListener("click", () => {\n  console.log("Button clicked");\n});',
    'function isValidEmail(value) { return value.includes("@"); }\nconsole.log(isValidEmail("learner@example.com"));',
    'async function loadCourses() {\n  const response = await fetch("/api/courses");\n  return response.json();\n}',
    'try {\n  JSON.parse("{bad json}");\n} catch (error) {\n  console.log("Check the input", error.message);\n}',
    'const settings = { theme: "light" };\nlocalStorage.setItem("settings", JSON.stringify(settings));',
    'const total = [4, 6, 8].reduce((sum, value) => sum + value, 0);\nconsole.log(total);',
    'const message = "Keep practicing";\ndocument.body.innerHTML = `<main><h1>${message}</h1></main>`;',
  ],
  Python: [
    'learner = "Sam"\nminutes = 20\nprint(f"{learner} studied for {minutes} minutes")',
    'price = 24.5\nprint(f"${price:.2f}")',
    'name = input("Your name: ").strip()\nprint(f"Welcome, {name}!")',
    'score = 82\nif score >= 70:\n    print("Passed")\nelse:\n    print("Keep practicing")',
    'for lesson in ["HTML", "CSS", "Python"]:\n    print(lesson)',
    'def add(a, b):\n    return a + b\n\nprint(add(3, 4))',
    'scores = [72, 88, 95]\nprint(scores[0], scores[-1])',
    'learner = {"name": "Sam", "active": True}\nprint(learner["name"])',
    'unique_topics = {"loops", "functions", "loops"}\nprint(unique_topics)',
    'def average(values):\n    return sum(values) / len(values)\n\nprint(average([70, 80, 90]))',
    'from pathlib import Path\nprint(Path("notes.txt").exists())',
    'try:\n    age = int("twenty")\nexcept ValueError:\n    print("Enter a whole number")',
    'class Course:\n    def __init__(self, title):\n        self.title = title\n\nprint(Course("Python").title)',
    'def find_lesson(lessons, title):\n    return title in lessons\n\nprint(find_lesson(["Loops"], "Loops"))',
    'tasks = ["Read", "Practice", "Review"]\nfor number, task in enumerate(tasks, start=1):\n    print(number, task)',
  ],
  PHP: [
    '<?php\n$name = "Sam";\necho "Welcome, {$name}!";',
    '<?php\n$minutes = 20;\n$passed = $minutes >= 15;\nvar_dump($passed);',
    '<?php\n$topics = ["HTML", "CSS", "PHP"];\nforeach ($topics as $topic) echo $topic . PHP_EOL;',
    '<?php\nfunction add(int $a, int $b): int { return $a + $b; }\necho add(3, 4);',
    '<?php\n$course = ["title" => "PHP", "lessons" => 15];\necho $course["title"];',
    '<?php\n$email = filter_var("learner@example.com", FILTER_VALIDATE_EMAIL);\nvar_dump($email);',
    '<?php\n$name = htmlspecialchars($_POST["name"] ?? "", ENT_QUOTES, "UTF-8");\necho $name;',
    '<?php\nsession_start();\n$_SESSION["learner_id"] = 42;',
    '<?php\n$pdo = new PDO($dsn, $user, $password);\n$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);',
    '<?php\n$stmt = $pdo->prepare("SELECT id FROM courses WHERE slug = ?");\n$stmt->execute([$slug]);',
    '<?php\n$passwordHash = password_hash($password, PASSWORD_DEFAULT);\necho password_verify($password, $passwordHash);',
    '<?php\nif ($userId !== $courseOwnerId) { http_response_code(403); exit; }',
    '<?php\n$items = ["Read", "Practice"];\necho count($items);',
    '<?php\ntry { $pdo->beginTransaction(); $pdo->commit(); } catch (Throwable $e) { $pdo->rollBack(); }',
    '<?php\n$title = "Learning plan";\necho htmlspecialchars($title, ENT_QUOTES, "UTF-8");',
  ],
  MySQL: [
    'CREATE TABLE learners (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  name VARCHAR(100) NOT NULL\n);',
    'CREATE TABLE enrollments (\n  student_id INT NOT NULL,\n  course_id INT NOT NULL,\n  PRIMARY KEY (student_id, course_id)\n);',
    'SELECT title, difficulty FROM courses;',
    'SELECT title FROM courses WHERE difficulty = \'beginner\' ORDER BY title;',
    'SELECT title FROM courses LIMIT 10 OFFSET 0;',
    'INSERT INTO courses (title, difficulty) VALUES (\'SQL basics\', \'beginner\');',
    'UPDATE courses SET difficulty = \'intermediate\' WHERE id = 3;',
    'DELETE FROM courses WHERE id = 3;',
    'SELECT courses.title, users.full_name\nFROM courses JOIN users ON users.id = courses.instructor_id;',
    'SELECT difficulty, COUNT(*) AS course_count\nFROM courses GROUP BY difficulty;',
    'SELECT instructor_id, COUNT(*) AS course_count\nFROM courses GROUP BY instructor_id HAVING COUNT(*) > 1;',
    'SELECT title FROM courses WHERE id IN (SELECT course_id FROM enrollments);',
    'CREATE INDEX idx_courses_difficulty ON courses (difficulty);',
    'START TRANSACTION;\nUPDATE accounts SET balance = balance - 10 WHERE id = 1;\nROLLBACK;',
    'CREATE TABLE modules (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  course_id INT NOT NULL,\n  title VARCHAR(180) NOT NULL,\n  FOREIGN KEY (course_id) REFERENCES courses(id)\n);',
  ],
  'Data Structures': [
    'const values = [10, 20, 30];\nvalues.push(40);\nconsole.log(values[0], values.length);',
    '// A node stores a value and a link to the next node.\nconst node = { value: 10, next: null };\nconsole.log(node.value);',
    'const stack = [];\nstack.push("first");\nstack.push("second");\nconsole.log(stack.pop());',
    'const queue = ["first", "second"];\nconst next = queue.shift();\nconsole.log(next);',
    'const counts = new Map();\ncounts.set("loops", 2);\nconsole.log(counts.get("loops"));',
    'const tags = new Set(["html", "css", "html"]);\nconsole.log(tags.size);',
    'const tree = { value: 8, left: { value: 4 }, right: { value: 12 } };\nconsole.log(tree.left.value);',
    'const heap = [3, 7, 5];\nheap.sort((a, b) => a - b);\nconsole.log(heap[0]); // minimum',
    'const graph = new Map([["A", ["B", "C"]], ["B", ["A"]]]);\nconsole.log(graph.get("A"));',
    'const graph = { A: ["B", "C"], B: ["A"], C: ["A"] };\nconst visited = new Set(["A"]);\nconsole.log(visited.has("A"));',
    'const values = [2, 4, 6, 8];\nconsole.log(values.includes(6)); // linear search',
    'const sorted = [2, 4, 6, 8];\nconsole.log(sorted[ Math.floor(sorted.length / 2) ]);',
    'const values = [5, 2, 4];\nvalues.sort((a, b) => a - b);\nconsole.log(values);',
    'function contains(values, target) {\n  return values.includes(target);\n}\nconsole.log(contains([1, 2, 3], 2));',
    'const operations = { arrayLookup: "O(1)", linearSearch: "O(n)" };\nconsole.log(operations.linearSearch);',
  ],
};

const languageNotes = {
  'HTML & CSS': 'Use semantic HTML to describe page content, then CSS rules to control how that content looks and adapts to different screens.',
  JavaScript: 'JavaScript runs in the browser and can transform data, respond to events, and update the page. Use the console to inspect each example.',
  Python: 'Python emphasizes readable syntax. Run each example, trace the values, and change one input to see how the result changes.',
  PHP: 'PHP runs on the server. The examples focus on safe request handling and common application patterns; database examples use PDO.',
  MySQL: 'MySQL stores structured data in related tables. Try each statement in a practice database and inspect how the result changes.',
  'Data Structures': 'Data structures organize values so common operations become easier to reason about. Trace each operation and compare its cost.',
};

const practiceGuidance = {
  'HTML & CSS': 'In the browser preview, inspect the page structure first and then change one style at a time. Check the result at a narrow and a wide screen size, and confirm that the page remains understandable without relying on color alone.',
  JavaScript: 'In the browser editor, predict the output before running the code. Then inspect the page or console, change one input, and compare the actual result with your prediction. This makes values, control flow, and browser behavior easier to trace.',
  Python: 'Read the example from top to bottom and write down the value of important variables after each step. Try the same logic with a different input and check how the result changes. The editor keeps your code ready to copy into a Python runtime.',
  PHP: 'Trace which values arrive from the request and which values are returned to the browser. Try a valid input and an invalid one, then check that validation happens before the application uses the data. The editor keeps your code ready to copy into a PHP runtime.',
  MySQL: 'Before running a query, identify which table supplies each column and predict how many rows should match. Run read-only SELECT statements first, inspect the results, and use a transaction when practicing changes to data.',
  'Data Structures': 'Trace the structure before and after each operation. Note which values are visited, inserted, removed, or compared, and estimate how the work grows as the input gets larger. The examples use JavaScript to make these operations interactive.',
};

const lessonNotes = {
  'HTML & CSS': [
    'Semantic elements such as main, nav, article, and section describe the purpose of page content.',
    'Heading levels create a logical outline, while paragraphs group readable blocks of text.',
    'Links navigate to resources; descriptive alt text explains useful images to screen reader users.',
    'Lists group related items, and tables present data with clear row and column headings.',
    'Labels connected to input IDs make forms easier to use with keyboards and assistive technology.',
    'Native input types and required constraints provide useful browser validation for common fields.',
    'Selectors target elements, and the cascade resolves competing declarations by origin, importance, and specificity.',
    'Color contrast and readable type sizes help people scan and understand interface content.',
    'The box model combines content, padding, border, and margin to determine an element’s size.',
    'Flexbox distributes and aligns items along a row or column.',
    'Grid places content in rows and columns for two-dimensional page layouts.',
    'Media queries adapt layout rules to available screen width and user preferences.',
    'Reusable component classes keep related styles consistent across a page.',
    'Visible focus styles show keyboard users which control is currently selected.',
    'A responsive page combines semantic structure, flexible layout, readable text, and accessible controls.',
  ],
  JavaScript: [
    'Variables give values meaningful names; const is a good default when reassignment is unnecessary.',
    'JavaScript values have types, and operators combine or compare values to produce new results.',
    'Boolean expressions and conditional branches choose behavior based on current data.',
    'Loops repeat a task for each item or while a condition remains true.',
    'Functions package reusable steps and can receive inputs through parameters.',
    'Scope determines where a variable can be accessed; return sends a result to the caller.',
    'Arrays store ordered values, and methods such as map and filter transform collections.',
    'Objects group related values under property names and model individual entities.',
    'Destructuring reads properties into variables, while spread copies iterable or object values.',
    'DOM selectors find page elements so a script can read or update them.',
    'Event handlers run in response to actions such as clicks and keyboard input.',
    'Form validation checks user input before an application accepts or processes it.',
    'Promises represent future results, and async/await makes asynchronous steps easier to follow.',
    'Errors can be caught and inspected so failures produce useful feedback instead of silent bugs.',
    'JSON serializes data for transfer or storage, while localStorage keeps small values in the browser.',
  ],
  Python: [
    'Variables bind readable names to values, and built-in types represent text, numbers, and truth values.',
    'Formatted strings combine values with text without manual concatenation.',
    'Input reads user text and output displays results; validate and convert input before using it.',
    'Conditions compare values and select which block of code should run.',
    'For loops visit items in a sequence; while loops repeat as long as a condition is true.',
    'Functions name reusable behavior, accept parameters, and return values to their caller.',
    'Lists are ordered, mutable collections that support indexing, slicing, and iteration.',
    'Dictionaries map keys to values for efficient lookup of named data.',
    'Sets hold unique values and support fast membership checks.',
    'Modules organize reusable Python code and imports make that code available elsewhere.',
    'Classes define a kind of object, and instances store state in attributes.',
    'Methods define behavior on objects; inheritance shares behavior between related classes.',
    'Path and file objects let programs read and write data outside memory.',
    'Exceptions represent runtime failures; catching a specific exception enables a safe recovery path.',
    'A command-line tool combines validated inputs, focused functions, and clear output.',
  ],
  PHP: [
    'PHP code runs on the server, and echo sends text into the generated response.',
    'Variables hold values; explicit types and clear names make server-side logic easier to maintain.',
    'Strings and arrays represent text and collections, and associative arrays use named keys.',
    'Conditions select behavior based on request data and application state.',
    'Loops process repeated records or steps without duplicating code.',
    'Functions group reusable behavior and scope controls where variables are available.',
    'Forms send data to the server, commonly with GET for retrieval and POST for changes.',
    'Validation checks submitted data against expected formats and application rules.',
    'Sessions associate server-side state with a browser across multiple requests.',
    'PDO provides a consistent interface for connecting PHP applications to relational databases.',
    'Prepared statements bind values separately from SQL, reducing injection risk.',
    'Create, read, update, and delete actions form the basic lifecycle of application records.',
    'Password hashing stores a one-way password verifier instead of the original password.',
    'Authorization checks verify a user may access a specific record before changing or returning it.',
    'A secure PHP feature validates input, checks access, uses prepared queries, and escapes output.',
  ],
  MySQL: [
    'Tables organize records into rows and columns; primary keys uniquely identify each row.',
    'Column types and constraints limit stored values and protect data quality.',
    'Relationships connect tables through keys instead of repeating the same data.',
    'SELECT retrieves chosen columns, and aliases give results useful names.',
    'WHERE filters rows before ORDER BY arranges the matching results.',
    'LIMIT and OFFSET return a manageable page of results; DISTINCT removes duplicates.',
    'INSERT adds records while respecting required columns and constraints.',
    'UPDATE changes matching rows, so a careful WHERE clause prevents accidental broad edits.',
    'DELETE removes matching records and foreign keys protect related data.',
    'JOIN combines related rows using a shared key; LEFT JOIN also keeps unmatched rows from its left side.',
    'Aggregate functions summarize groups, such as counting rows or calculating an average.',
    'GROUP BY forms groups and HAVING filters those groups after aggregation.',
    'Subqueries use the result of one query as input to another.',
    'Indexes can speed up lookups, but add storage and write costs; query plans show how they are used.',
    'Transactions group related statements so they can be committed together or rolled back safely.',
  ],
  'Data Structures': [
    'Arrays store indexed values contiguously and provide constant-time access by index.',
    'A linked-list node stores a value and a reference to the next node.',
    'Doubly linked nodes reference both neighbors, making removal easier when a node is known.',
    'A stack uses last-in, first-out order and supports push and pop operations.',
    'A queue uses first-in, first-out order and supports enqueue and dequeue operations.',
    'A deque supports insertion and removal at both ends.',
    'A hash map converts keys to storage locations and resolves collisions when keys overlap.',
    'A set stores unique values and answers membership questions without duplicates.',
    'A binary search tree orders values so comparisons guide search toward one subtree.',
    'Tree traversals visit each node in a defined order such as preorder or inorder.',
    'A heap keeps the highest- or lowest-priority value available at its root.',
    'An adjacency list stores each graph vertex with the vertices connected to it.',
    'Graph traversal uses a visited set to avoid processing the same vertex repeatedly.',
    'Binary search halves the remaining sorted search range after each comparison.',
    'Big O describes how resource use grows as input size increases, helping compare trade-offs.',
  ],
};

const distractors = [
  'Skip checking the inputs and assume every case works.',
  'Change several unrelated parts at once without testing.',
  'Ignore the output and rely on the code looking familiar.',
];

export function starterLessonContent(courseTitle, moduleTitle, lessonTitle) {
  const lessonTitles = getStarterLessonTitles(courseTitle);
  const index = lessonTitles.indexOf(lessonTitle);
  const brief = lessonNotes[courseTitle][index] || `${lessonTitle} is part of ${moduleTitle}.`;
  return [
    `Brief explanation:\n${brief}`,
    `Detailed explanation:\n${brief} ${languageNotes[courseTitle]}\n\nWhy it matters: ${lessonTitle} is one of the building blocks in ${moduleTitle.toLowerCase()}. Recognizing when and why to use this idea helps you make code easier to understand, test, and extend instead of relying on memorized examples.\n\nHow to practice: ${practiceGuidance[courseTitle]}\n\nCheck your understanding: Explain the main idea in your own words, identify it in the code example, and predict what will happen after one small change. Test that prediction and use any difference between the expected and actual result to guide your next step.`,
  ].join('\n\n');
}

export function starterExercise(courseTitle, lessonTitle, example) {
  return {
    title: `Practice: ${lessonTitle}`,
    instructions: `Create a small example that demonstrates ${lessonTitle.toLowerCase()}. Use the starter as a guide, make one meaningful change, and test the result. In your submission, include a short note explaining what you changed and why it works.`,
    exerciseType: 'code',
    starterHtml: courseTitle === 'HTML & CSS' ? example : '',
    starterCss: '',
    starterJavascript: courseTitle === 'JavaScript' || courseTitle === 'Data Structures' ? example : '',
  };
}

export function starterQuizPair(courseTitle, lessonTitle) {
  const topic = lessonTitle.toLowerCase();
  const lessonTitles = getStarterLessonTitles(courseTitle);
  const index = lessonTitles.indexOf(lessonTitle);
  const answers = lessonNotes[courseTitle];
  const answer = answers[index];
  const options = [answer, answers[(index + 1) % answers.length], answers[(index + 2) % answers.length], distractors[0]];
  return [
    {
      title: `Knowledge check: ${lessonTitle}`,
      question: `Which statement best describes ${topic}?`,
      options,
    },
    {
      title: `Apply it: ${lessonTitle}`,
      question: `Your ${topic} example behaves unexpectedly. What is the best first step?`,
      options: [
        'Check the inputs and logic, then compare the actual result with the expected result.',
        distractors[0], distractors[1], distractors[2],
      ],
    },
  ];
}

export function starterCode(courseTitle, index, lessonTitle) {
  return examples[courseTitle][index]
    || `// ${lessonTitle}\n// Try a small example, then change one value and inspect the result.`;
}
