import type { CollectionAction } from '@keystatic/core';

export const key = 'test-action';
export const label = 'Test Action';
export const description = 'A simple test action to verify the action system works';

export const handler: CollectionAction['handler'] = async ({
  currentState,
  setState,
  toast,
}) => {
  try {
    const confirmed = confirm('This is a test action. Update the title to "TEST: " + current title?');

    if (!confirmed) {
      return {
        success: false,
        error: 'Action cancelled',
      };
    }

    const name = `AI generated`;

    setState({
      ...currentState,
      title: {
        name: name,
      },
    });

    toast.positive('Title updated successfully!');

    return {
      success: true,
      message: `Title changed to: ${JSON.stringify(name)}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const condition: CollectionAction['condition'] = ({ currentState }) => {
  console.log(currentState);
  return true;
};