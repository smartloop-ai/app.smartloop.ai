'use client';

import { Box } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ActivityTimelineProps {
  user: any;
}

interface Activity {
  id: string;
  type: 'project' | 'document' | 'milestone';
  title: string;
  description: string;
  timestamp: Date;
  icon: React.ReactNode;
  color: string;
}

export default function ActivityTimeline({ user }: ActivityTimelineProps) {
  if (!user) return null;

  // Generate activity list from user data
  const activities: Activity[] = [];

  // Add recent projects
  if (user.projects && user.projects.length > 0) {
    user.projects
      .slice(0, 5)
      .forEach((project: any) => {
        activities.push({
          id: `project-${project.id}`,
          type: 'project',
          title: 'Created Project',
          description: project.title || project.name || 'Untitled Project',
          timestamp: new Date(project.created_at || project.createdAt || Date.now()),
          icon: <FolderOpenIcon sx={{ fontSize: 16 }} />,
          color: '#ec4899',
        });

        // Add documents from this project
        if (project.documents && project.documents.length > 0) {
          project.documents.slice(0, 2).forEach((doc: any) => {
            activities.push({
              id: `doc-${doc.id}`,
              type: 'document',
              title: 'Uploaded Document',
              description: doc.name || 'Untitled Document',
              timestamp: new Date(doc.created_at || doc.createdAt || Date.now()),
              icon: <DescriptionIcon sx={{ fontSize: 16 }} />,
              color: '#60a5fa',
            });
          });
        }
      });
  }

  // Add milestone for account creation
  if (user.created_at || user.createdAt) {
    activities.push({
      id: 'milestone-signup',
      type: 'milestone',
      title: 'Joined Smartloop',
      description: 'Welcome to the platform!',
      timestamp: new Date(user.created_at || user.createdAt),
      icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
      color: '#10b981',
    });
  }

  // Sort by timestamp descending and take top 7
  const sortedActivities = activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 7);

  if (sortedActivities.length === 0) {
    return (
      <Box
        sx={{
          bgcolor: 'rgba(26, 26, 26, 0.5)',
          border: '1px solid var(--border-2)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 className="text-content text-lg font-semibold mb-4">Recent Activity</h3>
        <Box className="text-muted text-sm text-center py-8">
          No recent activity. Start by creating a project!
        </Box>
      </Box>
    );
  }

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <Box
      sx={{
        bgcolor: 'rgba(26, 26, 26, 0.5)',
        border: '1px solid var(--border-2)',
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <h3 className="text-content text-lg font-semibold mb-6">Recent Activity</h3>
      <Box className="space-y-4">
        {sortedActivities.map((activity, index) => (
          <Box
            key={activity.id}
            sx={{
              display: 'flex',
              gap: 2,
              position: 'relative',
              paddingBottom: index === sortedActivities.length - 1 ? 0 : '16px',
            }}
          >
            {/* Timeline line */}
            {index !== sortedActivities.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  left: '15px',
                  top: '32px',
                  bottom: 0,
                  width: '2px',
                  bgcolor: 'var(--border-2)',
                }}
              />
            )}

            {/* Icon */}
            <Box
              sx={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                bgcolor: `${activity.color}20`,
                border: `1px solid ${activity.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                zIndex: 1,
                color: activity.color,
              }}
            >
              {activity.icon}
            </Box>

            {/* Content */}
            <Box className="flex-1 min-w-0">
              <Box className="flex items-start justify-between gap-2">
                <Box className="flex-1 min-w-0">
                  <Box className="text-content text-sm font-medium">{activity.title}</Box>
                  <Box className="text-muted text-sm truncate">{activity.description}</Box>
                </Box>
                <Box className="text-faint text-xs whitespace-nowrap">
                  {formatTimestamp(activity.timestamp)}
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

