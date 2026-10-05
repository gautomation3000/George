import { TeamMember } from '../types/sheet';
import { INITIAL_EQUIPMENT_DATA } from './equipmentData';

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'user_1',
    name: 'Rahul Sharma',
    email: 'rahul.s@company.internal',
    color: '#3B82F6', // Blue
    status: 'online',
    lastActive: 'Just now',
  },
  {
    id: 'user_2',
    name: 'Neelakandan',
    email: 'neelakandan@company.internal',
    color: '#10B981', // Emerald
    status: 'editing',
    activeRowId: 'item_2',
    lastActive: '1m ago',
  },
  {
    id: 'user_3',
    name: 'Gopal',
    email: 'gopal@company.internal',
    color: '#8B5CF6', // Purple
    status: 'online',
    lastActive: '3m ago',
  },
  {
    id: 'user_4',
    name: 'Devaraj',
    email: 'devaraj@company.internal',
    color: '#F59E0B', // Amber
    status: 'idle',
    lastActive: '10m ago',
  },
  {
    id: 'user_5',
    name: 'Ajith Kumar',
    email: 'ajith.k@company.internal',
    color: '#EC4899', // Pink
    status: 'online',
    lastActive: '2m ago',
  },
];

export const INITIAL_SHEET_ROWS = INITIAL_EQUIPMENT_DATA;
