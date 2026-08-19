// DTO para empleado
export class EmployeeDto {
  id!: string;
  name!: string;
  role!: string;
  initials!: string;
  avatarUrl?: string | null;
}

// DTO para cumpleaños
export class BirthdayDto {
  id!: string;
  name!: string;
  day!: string;
  month!: string;
  isWeekend!: boolean;
  employee!: EmployeeDto;
}

// DTO para publicación de cumpleaños
export class BirthdayPostDto {
  id!: string;
  author!: string;
  authorAvatar!: string;
  authorRole!: string;
  content!: string;
  timestamp!: string;
  likes!: number;
  comments!: number;
  shares!: number;
  liked!: boolean;
  commentsList!: any[];
  isBirthdayPost!: boolean;
  birthdayPerson!: string;
}

// DTO de respuesta
export class BirthdayPostsResponseDto {
  birthdayPosts!: BirthdayPostDto[];
  todayBirthdays!: BirthdayDto[];
  monthBirthdays!: BirthdayDto[];
  generatedAt!: string;
  count!: {
    birthdayPosts: number;
    todayBirthdays: number;
    monthBirthdays: number;
  };
}