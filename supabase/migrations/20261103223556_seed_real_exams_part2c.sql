-- OOP — Sheet 4 (Real)  (4 questions, from quiz-real-oop-sheet-4.json)
WITH q AS (
  INSERT INTO public.quizzes (title, description, subject, department, year, status, source_type, duration_seconds)
  SELECT 'البرمجة الكائنية — الشيت 4 (حقيقي)', '{"description":"Real questions extracted verbatim from the Drive sheet downloads/oop/Sheet_4.pdf (pages p1). Correct answers are grounded in the sheet/answer files; wrong options are constructed. Replace nothing — this is the actual course content.","department":"AI","year":"المستوى الثاني","subject":"البرمجة الكائنية","semester":"1"}', 'البرمجة الكائنية', 'AI', 'المستوى الثاني', 'approved', 'manual', 300
  WHERE NOT EXISTS (SELECT 1 FROM public.quizzes WHERE title = 'البرمجة الكائنية — الشيت 4 (حقيقي)')
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_answer, explanation, order_index)
SELECT q.id, v.question, v.options, v.correct_answer, v.explanation, v.order_index
FROM q, (VALUES
  ('Write a program to find the factorial value of any number entered through the keyboard. Which core loop is correct?', '["long fact=1;\nfor (int i=1;i<=num;i++) fact*=(long)i;","long fact=0;\nfor (int i=1;i<=num;i++) fact+=(long)i;","long fact=1;\nfor (int i=1;i<num;i++) fact*=(long)i;","long fact=num;\nfor (int i=1;i<=num;i++) fact+=i;"]'::jsonb, 0, 'Identical task to Sheet 2 Q8, solved by the accepted solution (fact.txt / Sheet_2_Q8.java). — المصدر: Sheet_4.pdf، ص1', 1),
  ('Write a program to print out all Armstrong numbers between 1 and 500 (sum of cubes of digits equals the number; e.g. 153 = 1³+5³+3³). Which set is correct?', '["1, 153, 370, 371, 407","1, 153, 370, 372, 407","1, 152, 370, 371, 407","2, 153, 370, 371, 407"]'::jsonb, 0, 'Determined by the task definition, computed and double-checked: 1, 153, 370, 371, 407. — المصدر: Sheet_4.pdf، ص1', 2),
  ('Write a program to print Fibonacci series of n terms where n is input by user. The series is:', '["0 1 1 2 3 5 8 13 21…","0 1 1 2 3 5 8 13 20…","1 1 2 3 5 8 13 21 34…","0 1 2 3 5 8 13 21 34…"]'::jsonb, 0, 'Verbatim series from Sheet 4 Q5. — المصدر: Sheet_4.pdf، ص1', 3),
  ('Write a program that outputs an integer with the digits reversed; e.g. input 12345. What is the output for that input?', '["54321","12345","54312","32154"]'::jsonb, 0, 'Verbatim example from Sheet 4 Q10. — المصدر: Sheet_4.pdf، ص1', 4)
) AS v(question, options, correct_answer, explanation, order_index);

-- OOP — Sheet 5 (Real)  (4 questions, from quiz-real-oop-sheet-5.json)
WITH q AS (
  INSERT INTO public.quizzes (title, description, subject, department, year, status, source_type, duration_seconds)
  SELECT 'البرمجة الكائنية — الشيت 5 (حقيقي)', '{"description":"Real questions extracted verbatim from the Drive sheet downloads/oop/Sheet_5.pdf (pages p1). Correct answers are grounded in the sheet/answer files; wrong options are constructed. Replace nothing — this is the actual course content.","department":"AI","year":"المستوى الثاني","subject":"البرمجة الكائنية","semester":"1"}', 'البرمجة الكائنية', 'AI', 'المستوى الثاني', 'approved', 'manual', 300
  WHERE NOT EXISTS (SELECT 1 FROM public.quizzes WHERE title = 'البرمجة الكائنية — الشيت 5 (حقيقي)')
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_answer, explanation, order_index)
SELECT q.id, v.question, v.options, v.correct_answer, v.explanation, v.order_index
FROM q, (VALUES
  ('Write a function to compute the sum of all integers from 1 to any given integer — header: public static int compute Sum(int n). Which core body is correct?', '["int sum=0;\nfor (int i=1;i<=n;i++) sum+=i;\nreturn sum;","int sum=0;\nfor (int i=0;i<n;i++) sum+=i;\nreturn sum;","int sum=1;\nfor (int i=1;i<n;i++) sum*=i;\nreturn sum;","return n*(n+1);"]'::jsonb, 0, 'Same task as Sheet 2 Q3; accepted solution (answers-walled_1-2.txt / Sheet_2_Q3.java) as a function body. — المصدر: Sheet_5.pdf، ص1', 1),
  ('Write a function to compute x^y for any given two integers x and y. Which core body is correct?', '["int pow=1;\nfor (int i=1;i<=y;i++) pow*=x;\nreturn pow;","int pow=0;\nfor (int i=1;i<=y;i++) pow+=x;\nreturn pow;","int pow=1;\nfor (int i=1;i<=x;i++) pow*=y;\nreturn pow;","return x**y;"]'::jsonb, 0, 'Same task as Sheet 2 Q7; accepted solution core (answers-walled_power.txt / Sheet_2_Q7.java). — المصدر: Sheet_5.pdf، ص1', 2),
  ('Write a function to compute the factorial of any given integer. Which core body is correct?', '["int fact=1;\nfor (int i=1;i<=num;i++) fact*=i;\nreturn fact;","int fact=0;\nfor (int i=1;i<=num;i++) fact+=i;\nreturn fact;","int fact=1;\nfor (int i=1;i<num;i++) fact*=i;\nreturn fact;","int fact=num;\nwhile (num>1) fact=num--; return fact;"]'::jsonb, 0, 'Same task as Sheet 2 Q8; accepted solution core (answers-walled_fact.txt / Sheet_2_Q8.java). — المصدر: Sheet_5.pdf، ص1', 3),
  ('Write a function that inputs an integer and returns the number with the digits reversed; e.g. input 12345. What is the returned value for that input?', '["54321","12345","54312","32154"]'::jsonb, 0, 'Verbatim example from Sheet 5 Q11. — المصدر: Sheet_5.pdf، ص1', 4)
) AS v(question, options, correct_answer, explanation, order_index);

-- OOP — Sheet 7 (Real)  (4 questions, from quiz-real-oop-sheet-7.json)
WITH q AS (
  INSERT INTO public.quizzes (title, description, subject, department, year, status, source_type, duration_seconds)
  SELECT 'البرمجة الكائنية — الشيت 7 (حقيقي)', '{"description":"Real questions extracted verbatim from the Drive sheet downloads/oop/Sheet_7.pdf (pages p1-2). Correct answers are grounded in the sheet/answer files; wrong options are constructed. Replace nothing — this is the actual course content.","department":"AI","year":"المستوى الثاني","subject":"البرمجة الكائنية","semester":"1"}', 'البرمجة الكائنية', 'AI', 'المستوى الثاني', 'approved', 'manual', 300
  WHERE NOT EXISTS (SELECT 1 FROM public.quizzes WHERE title = 'البرمجة الكائنية — الشيت 7 (حقيقي)')
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_answer, explanation, order_index)
SELECT q.id, v.question, v.options, v.correct_answer, v.explanation, v.order_index
FROM q, (VALUES
  ('Write a Program to Print the Pascal''s Triangle in Java (Input N = 5). Which output matches the sheet?', '[" 1\n 1 1\n 1 2 1\n 1 3 3 1\n 1 4 6 4 1\n1 5 10 10 5 1"," 1\n 1 1\n 1 2 1\n 1 3 3 1\n 1 4 6 4 1"," 1\n 1 1\n 2 1 1\n 3 3 1 1\n 6 4 4 1\n10 10 5 5 1 1"," 1\n 2 1\n 3 3 1\n 4 6 4 1\n 5 10 10 5 1"]'::jsonb, 0, 'Verbatim Pascal''s triangle (N=5) printed in Sheet 7 Q8. — المصدر: Sheet_7.pdf، ص1', 1),
  ('Write the Java class for this UML: Point { - x : int, - y : int | + setX(xx : int), + setY(yy : int), + getX() : int, + getY() : int }. Which declaration matches?', '["private int x;\nprivate int y;\npublic void setX(int xx){...}\npublic void setY(int yy){...}\npublic int getX(){...}\npublic int getY(){...}","public int x;\npublic int y;\nprivate void setX(int xx){...}\nprivate void setY(int yy){...}","private double x;\nprivate double y;\npublic void setX(double xx){...}\npublic int getY(){...}","protected int x, y;\npublic void point(int xx, int yy){...}"]'::jsonb, 0, 'Verbatim from the UML: fields x,y are private ints (−), the four accessors are public (+). — المصدر: Sheet_7.pdf، ص1', 2),
  ('Write the Java class for this UML: Circle { - radius : double, - center : Point | + getArea() : double, + getCircumfrence() : double }. Which declaration matches?', '["private double radius;\nprivate Point center;\npublic double getArea(){...}\npublic double getCircumfrence(){...}","private int radius;\nprivate Point center;\npublic int getArea(){...}","public double radius;\nprivate double center;\npublic double getArea(){...}","private double radius;\nprivate Circle center;\npublic double getCircumfrence(){...}"]'::jsonb, 0, 'Verbatim from the UML: radius double, center is a Point, both accessors return double. — المصدر: Sheet_7.pdf، ص2', 3),
  ('Write the Java class for this UML: Complex { - realPart : double = 0, - imaginaryPart : double = 0 | + setReal, + setImaginary, + getReal, + getImaginary }. Which declaration matches?', '["private double realPart = 0;\nprivate double imaginaryPart = 0;\npublic void setReal(double theRealPart){...}\npublic void setImaginary(double theImaginaryPart){...}\npublic double getReal(){...}\npublic double getImaginary(){...}","private double realPart;\nprivate double imaginaryPart;\npublic void setReal(int theRealPart){...}","public double realPart = 1;\npublic double imaginaryPart = 1;","private int realPart = 0;\nprivate int imaginaryPart = 0;\npublic double getReal(){...}"]'::jsonb, 0, 'Verbatim from the UML: both fields private double initialized to 0; setters take double parameters. — المصدر: Sheet_7.pdf، ص2', 4)
) AS v(question, options, correct_answer, explanation, order_index);

-- Signals & Systems — MATLAB Sections (Real)  (15 questions, from quiz-real-signals-matlab.json)
WITH q AS (
  INSERT INTO public.quizzes (title, description, subject, department, year, status, source_type, duration_seconds)
  SELECT 'إشارات وأنظمة — سكاشن MATLAB (حقيقي)', '{"description":"Real questions extracted from downloads/signals-systems/MATLAB_1..3.pdf (MATLAB basics, vectors & matrices, symbolic math & plotting). Facts printed verbatim in the decks; wrong options constructed.","department":"AI","year":"المستوى الثاني","subject":"الإشارات والأنظمة","semester":"1"}', 'الإشارات والأنظمة', 'AI', 'المستوى الثاني', 'approved', 'manual', 900
  WHERE NOT EXISTS (SELECT 1 FROM public.quizzes WHERE title = 'إشارات وأنظمة — سكاشن MATLAB (حقيقي)')
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_answer, explanation, order_index)
SELECT q.id, v.question, v.options, v.correct_answer, v.explanation, v.order_index
FROM q, (VALUES
  ('What does MATLAB stand for?', '["Matrix Laboratory","Mathematical Laboratory","Matrix Learning","Mathematical Basic Laboratory"]'::jsonb, 0, 'MATLAB_1, p2 (verbatim): MATLAB stands for matrix Laboratory. — المصدر: MATLAB_1.pdf، صp2', 1),
  ('Is MATLAB case sensitive?', '["Yes — MATLAB is a case sensitive programming tool","No","Only for function names","Only for variable names"]'::jsonb, 0, 'MATLAB_1, p2 (verbatim). — المصدر: MATLAB_1.pdf، صp2', 2),
  ('Why do we put a semicolon ( ; ) at the end of a MATLAB command line?', '["To avoid the command being written in multiple lines / to suppress echoing output","To end the program","To start a comment","To declare a variable"]'::jsonb, 0, 'MATLAB_1, p4 (verbatim): to avoid that we put a semicolon at the end of each line. — المصدر: MATLAB_1.pdf، صp4', 3),
  ('What do the commands who and whos do?', '["who shows the number of declared variables; whos shows details about all declared variables","who clears variables; whos lists files","Both clear the command window","who opens a new script"]'::jsonb, 0, 'MATLAB_1, p5 (verbatim list). — المصدر: MATLAB_1.pdf، صp5', 4),
  ('What is the difference between cos(x) and cosd(x) in MATLAB?', '["cos(x) takes radians; cosd(x) takes degrees","cos(x) takes degrees; cosd(x) takes radians","cosd is the inverse of cos","They are identical"]'::jsonb, 0, 'MATLAB_1, p6 (verbatim): trigonometric functions have radiant form and degree form. — المصدر: MATLAB_1.pdf، صp6', 5),
  ('For the complex number x = 3+4i, what do real(x), imag(x), and conj(x) return?', '["3, 4i, and 3−4i","4i, 3, and 3−4i","3, 4, and 3+4i","5, 3, and 4i"]'::jsonb, 0, 'MATLAB_1, p6 (verbatim): real(x) → 3; imag(x) → 4i; conj(x) → 3−4i. — المصدر: MATLAB_1.pdf، صp6', 6),
  ('What is the difference between = and == in MATLAB?', '["= is used in assignments; == is used in relational (equality) tests","= is a relational test; == is an assignment","They are interchangeable","== only works on strings"]'::jsonb, 0, 'MATLAB_1, p8 (verbatim): many users confuse the double equality sign (==) used in relational tests with the equality sign (=) used in assignments. — المصدر: MATLAB_1.pdf، صp8', 7),
  ('What is an m-file?', '["An external file storing a sequence of MATLAB commands — either a script file or a function file","A compiled binary","A matrix saved to disk","A log of the command window"]'::jsonb, 0, 'MATLAB_1, p11 (verbatim): m-files have two types — script file and function file. — المصدر: MATLAB_1.pdf، صp11', 8),
  ('How do script variables and function variables differ in scope?', '["Script variables are global; function variables are local","Both are global","Both are local","Script variables are local; function variables are global"]'::jsonb, 0, 'MATLAB_1, p12 (verbatim comparison table). — المصدر: MATLAB_1.pdf، صp12', 9),
  ('How do you take a string input from the user in MATLAB?', '["input(message, ''s'')","input(message)","scanf(message)","getString(message)"]'::jsonb, 0, 'MATLAB_1, p14 (verbatim): input(message) takes a number; input(message,''s'') takes a string. — المصدر: MATLAB_1.pdf، صp14', 10),
  ('Which MATLAB command makes MATLAB treat x as a symbol instead of a variable?', '["syms","symbolic(x)","var(x)","str2sym only"]'::jsonb, 0, 'MATLAB_3, p2 (verbatim): MATLAB can''t see x as symbol; to make MATLAB see them as symbols we use syms. — المصدر: MATLAB_3.pdf، صp2', 11),
  ('Which commands perform differentiation and (bounded) integration in MATLAB?', '["diff(f) and int(f, low, high)","derivative(f) and integrate(f)","diff(f) and integral(f) only","d/dx and ∫"]'::jsonb, 0, 'MATLAB_3, p4-5 (verbatim): diff(f) for differentiation; int(f) / int(f,low,high) for integration. — المصدر: MATLAB_3.pdf، صp4-5', 12),
  ('What does hold on do in plotting?', '["Draws multiple plots in a single figure","Pauses the program","Clears the figure","Saves the figure"]'::jsonb, 0, 'MATLAB_3, p9 (verbatim): hold on to draw multiple plots in a single figure; hold off stops. — المصدر: MATLAB_3.pdf، صp9', 13),
  ('In MATLAB, indexing of vectors and matrices starts at:', '["1, not 0","0, not 1","−1","any index the user chooses"]'::jsonb, 0, 'MATLAB_2, p6 (verbatim): MATLAB indexing starts with 1, not 0. — المصدر: MATLAB_2.pdf، صp6', 14),
  ('Which command creates an identity matrix?', '["eye","identity","ones","diag"]'::jsonb, 0, 'MATLAB_2, p10 (verbatim special-matrices list): eye = identity matrix. — المصدر: MATLAB_2.pdf، صp10', 15)
) AS v(question, options, correct_answer, explanation, order_index);


