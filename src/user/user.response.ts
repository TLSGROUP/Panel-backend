import {User} from 'prisma/generated/client';

export class UserResponse {
    items: User[]
    isHasMore: boolean
}