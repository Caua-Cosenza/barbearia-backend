// Never include: password, role (for non-admin), isAdmin flags
export interface UserResponseDto {
  id: string
  name: string
  email: string
  createdAt: string
}
