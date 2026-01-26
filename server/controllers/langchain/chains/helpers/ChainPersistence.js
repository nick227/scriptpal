import prisma from '../../../../db/prismaClient.js';

export const saveToDatabase = async(scriptId, data, options = {}) => {
  const defaults = {
    type: 'analysis',
    subtype: 'general',
    processContent: true
  };
  const config = { ...defaults, ...options };

  try {
    if (!scriptId) {
      console.log('No scriptId provided, skipping save');
      return;
    }

    const content = config.processContent
      ? (typeof data === 'string' ? data : JSON.stringify(data))
      : data;

    await prisma.scriptElement.create({
      data: {
        scriptId,
        type: config.type,
        payload: {
          subtype: config.subtype,
          content
        },
        source: 'ai'
      }
    }).catch(err => console.error(`Error saving ${config.type}:`, err));

  } catch (error) {
    console.error(`Error saving ${config.type}:`, error);
  }
};

export const saveElements = async(scriptId, elements, options = {}) => {
  const defaults = {
    type: 'element',
    getSubtype: (index) => `element_${index + 1}`,
    processElement: (element) => element
  };
  const config = { ...defaults, ...options };

  try {
    if (!scriptId || !Array.isArray(elements)) {
      console.log('Invalid save parameters, skipping save');
      return;
    }

    for (const [index, element] of elements.entries()) {
      const subtype = typeof config.getSubtype === 'function'
        ? config.getSubtype(index)
        : config.getSubtype;

      const processedElement = config.processElement(element);

      await saveToDatabase(scriptId, processedElement, {
        type: config.type,
        subtype: subtype,
        processContent: true
      });
    }
  } catch (error) {
    console.error(`Error saving ${config.type} elements:`, error);
  }
};
