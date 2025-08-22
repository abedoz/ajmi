import { useState, useEffect, useRef } from 'react';

export const useBackgroundTask = () => {
  const [backgroundTasks, setBackgroundTasks] = useState([]);
  const eventSourceRef = useRef(null);

  const startBackgroundTask = (taskId, streamUrl, onProgress, onComplete, onError) => {
    // Add task to the list
    setBackgroundTasks(prev => [...prev, {
      id: taskId,
      status: 'running',
      progress: 0,
      message: 'Starting...',
      startTime: Date.now()
    }]);

    // Create EventSource for streaming
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update task progress
        setBackgroundTasks(prev => prev.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                progress: data.progress || 0, 
                message: data.message || '',
                currentStep: data.currentStep || '',
                lastUpdate: Date.now()
              }
            : task
        ));

        // Call progress callback
        if (onProgress) onProgress(data);

        // Handle completion
        if (data.type === 'complete') {
          setBackgroundTasks(prev => prev.map(task => 
            task.id === taskId 
              ? { ...task, status: 'completed', progress: 100 }
              : task
          ));
          if (onComplete) onComplete(data);
          eventSource.close();
        }

        // Handle errors
        if (data.type === 'error') {
          setBackgroundTasks(prev => prev.map(task => 
            task.id === taskId 
              ? { ...task, status: 'error', message: data.message }
              : task
          ));
          if (onError) onError(data);
          eventSource.close();
        }

      } catch (parseError) {
        console.error('Error parsing background task data:', parseError);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Background task EventSource error:', error);
      setBackgroundTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'error', message: 'Connection error' }
          : task
      ));
      if (onError) onError({ message: 'Connection error' });
      eventSource.close();
    };

    return eventSource;
  };

  const stopBackgroundTask = (taskId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setBackgroundTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const clearCompletedTasks = () => {
    setBackgroundTasks(prev => prev.filter(task => task.status === 'running'));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    backgroundTasks,
    startBackgroundTask,
    stopBackgroundTask,
    clearCompletedTasks
  };
};

export default useBackgroundTask;
