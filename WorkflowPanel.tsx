import React, { useEffect, useState } from 'react';
import { useDocumentInfo } from 'payload/components/utilities';
import { useAuth } from 'payload/components/utilities';
import { Button } from 'payload/components/elements';
import { toast } from 'payload/components/elements';
import './WorkflowPanel.css';

interface WorkflowLog {
  id: string;
  stepId: string;
  action: string;
  user: { id: string; name: string }; // Simplified
  timestamp: string;
  comment?: string;
  outcome?: string;
}

interface WorkflowStep {
  stepId: string;
  name: string;
  type: 'approval' | 'review' | 'sign-off' | 'comment-only';
  assignedTo: { assigneeType: 'role' | 'user'; role?: string; user?: string };
}

interface WorkflowDoc {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

const WorkflowPanel: React.FC = () => {
  const { id: docId, slug: collectionSlug } = useDocumentInfo();
  const { user } = useAuth();
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [comment, setComment] = useState<string>('');

  useEffect(() => {
    const fetchWorkflowDetails = async () => {
      if (!docId || !collectionSlug) return;

      setLoading(true);
      try {
        // Fetch the document itself to get current workflow status fields
        const docRes = await fetch(`/api/${collectionSlug}/${docId}`);
        const doc = await docRes.json();

        if (doc.currentWorkflow) {
          // Fetch the full workflow definition
          const workflowRes = await fetch(`/api/workflows/${doc.currentWorkflow.id || doc.currentWorkflow}`);
          const workflow = await workflowRes.json();

          // Fetch workflow logs for this document
          const logsRes = await fetch(`/api/workflowLogs?where[document.value][equals]=${docId}&where[document.relationTo][equals]=${collectionSlug}&sort=-timestamp`);
          const logs = await logsRes.json();

          setWorkflowData({ ...doc, workflowDefinition: workflow });
          setWorkflowLogs(logs.docs);
        }
      } catch (err) {
        console.error('Error fetching workflow details:', err);
        toast.error('Failed to load workflow details.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflowDetails();
  }, [docId, collectionSlug]);

  if (loading) {
    return <div>Loading workflow details...</div>;
  }

  if (!workflowData || !workflowData.currentWorkflow) {
    return <div>No active workflow for this document.</div>;
  }

  const currentStep = workflowData.workflowDefinition.steps.find(
    (step: WorkflowStep) => step.stepId === workflowData.currentStep
  );

  const isAssignedToCurrentUser = () => {
    if (!currentStep || !user) return false;
    if (currentStep.assignedTo.assigneeType === 'user') {
      return currentStep.assignedTo.user === user.id;
    } else if (currentStep.assignedTo.assigneeType === 'role') {
      return Array.isArray(user.roles) && user.roles.includes(currentStep.assignedTo.role);
    }
    return false;
  };

  const handleWorkflowAction = async (action: string, outcome?: string) => {
    if (!docId || !collectionSlug || !currentStep || !user) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          collectionSlug: collectionSlug,
          workflowId: workflowData.currentWorkflow.id || workflowData.currentWorkflow,
          stepId: currentStep.stepId,
          action: action,
          outcome: outcome,
          comment: comment,
        }),
      });

      if (res.ok) {
        toast.success(`Workflow action '${action}' successful!`);
        // Re-fetch data to update UI
        // In a real app, you might use Payload's useSWR or similar for better real-time updates
        const docRes = await fetch(`/api/${collectionSlug}/${docId}`);
        const updatedDoc = await docRes.json();
        setWorkflowData({ ...updatedDoc, workflowDefinition: workflowData.workflowDefinition });
        const logsRes = await fetch(`/api/workflowLogs?where[document.value][equals]=${docId}&where[document.relationTo][equals]=${collectionSlug}&sort=-timestamp`);
        const updatedLogs = await logsRes.json();
        setWorkflowLogs(updatedLogs.docs);
        setComment('');
      } else {
        const errorData = await res.json();
        toast.error(`Workflow action failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error performing workflow action:', err);
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workflow-panel">
      <h3>Workflow Status: {workflowData.workflowStatus}</h3>
      <h3>Workflow Status: {workflowData.workflowStatus}</h3>
      {workflowData.workflowStatus === 'in_progress' && currentStep && (
        <>
          <p>Current Step: <strong>{currentStep.name} ({currentStep.type})</strong></p>
          <p>Assigned To: {currentStep.assignedTo.assigneeType === 'role' ? `Role: ${currentStep.assignedTo.role}` : `User: ${currentStep.assignedTo.user}`}</p>
          {isAssignedToCurrentUser() && (
            <div className="workflow-action-panel">
              <textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="workflow-comment-textarea"
              />
              {currentStep.type !== 'comment-only' && (
                <>
                  <Button onClick={() => handleWorkflowAction('approved', 'approved')} buttonStyle="primary" disabled={loading}>Approve</Button>
                  <span className="workflow-action-separator">
                    <Button onClick={() => handleWorkflowAction('rejected', 'rejected')} buttonStyle="secondary" disabled={loading}>Reject</Button>
                  </span>
                </>
              )}
              {currentStep.type === 'comment-only' && (
                <Button onClick={() => handleWorkflowAction('commented', 'completed')} buttonStyle="primary" disabled={loading}>Add Comment & Complete</Button>
              )}
            </div>
          )}
          {!isAssignedToCurrentUser() && (
            <p>You are not assigned to this step.</p>
          )}
        </>
      )}

      <h4>Workflow History</h4>
      {workflowLogs.length === 0 ? (
        <p>No workflow history yet.</p>
      ) : (
        <ul className="workflow-history-list">
          {workflowLogs.map((log) => (
            <li key={log.id} className="workflow-history-list-item">
              <strong>{log.action}</strong> by {log.user?.name || 'N/A'} on {new Date(log.timestamp).toLocaleString()}
              {log.outcome && ` (Outcome: ${log.outcome})`}
              {log.comment && <p className="workflow-history-comment">"<em>{log.comment}</em>"</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default WorkflowPanel;


