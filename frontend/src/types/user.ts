export interface User {
  user_id?: number;   // خليها optional عشان add مش هيكون فيه id
  username: string;
  email: string;
  role: string;
  password?: string;
  department_name?: string;
}
