const dashboardPaths = {
  admin: '/admin/dashboard',
  instructor: '/instructor/dashboard',
  student: '/student/dashboard',
};

export function dashboardPathForRole(role) {
  return dashboardPaths[role] ?? null;
}
