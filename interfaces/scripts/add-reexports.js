const fs = require('fs');
const path = require('path');

// Use __dirname to get the script's directory (interfaces/scripts/)
// Then navigate to dist/index.d.ts from there
const distPath = path.join(__dirname, '..', 'dist', 'index.d.ts');

const content = fs.readFileSync(distPath, 'utf8');

const types = ['ApiError', 'JwtPayload', 'LoginRequest', 'LoginResponse', 'UserInfo', 'Role', 'User', 'RegisterRequest', 'RateType', 'StudentStatus', 'Student', 'CreateStudentRequest', 'StudentResponse', 'UpdateStudentRequest', 'ListStudentsQuery', 'StudentListResponse', 'AttendanceStatus', 'LessonAcceptance', 'Lesson', 'CreateLessonRequest', 'UpdateLessonRequest', 'RecordAttendanceRequest', 'NotifyStudentRequest', 'ListLessonsQuery', 'LessonResponse', 'LessonListResponse', 'DayOfWeek', 'LessonSlot', 'LessonSeries', 'CreateRecurringLessonRequest', 'UpdateLessonSeriesRequest', 'LessonSeriesResponse', 'CreateRecurringLessonResponse', 'GenerateMeetLinkRequest', 'GenerateMeetLinkResponse'];

const reexports =
  '\n// Re-export types at top level for backward compatibility\n' +
  types.map(t => `export type ${t} = components['schemas']['${t}']`).join(';\n') +
  ';\n';

fs.writeFileSync(distPath, content + reexports);

console.log('✓ Added type re-exports for backward compatibility');
