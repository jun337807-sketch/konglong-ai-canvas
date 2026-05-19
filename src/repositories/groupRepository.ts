import { Group } from '../types/workspace';
import { groupService } from '../services/groupService';

export interface GroupRepository {
  list(): Promise<Group[]>;
  create(input: Partial<Group>): Promise<Group>;
  update(groupId: string, updates: Partial<Group>): Promise<Group | null>;
  remove(groupId: string): Promise<boolean>;
}

class LocalGroupRepository implements GroupRepository {
  list() {
    return groupService.getGroups();
  }

  create(input: Partial<Group>) {
    return groupService.createGroup(input);
  }

  update(groupId: string, updates: Partial<Group>) {
    return groupService.updateGroup(groupId, updates);
  }

  remove(groupId: string) {
    return groupService.deleteGroup(groupId);
  }
}

export const groupRepository: GroupRepository = new LocalGroupRepository();
