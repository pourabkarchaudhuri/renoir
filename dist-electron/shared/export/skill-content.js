export function briefAnswersToInputs(answers) {
    const skip = new Set(['locked']);
    return Object.entries(answers)
        .filter(([k, v]) => !skip.has(k) && v?.trim())
        .map(([k, v]) => ({
        label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: v.trim(),
    }));
}
export function buildDefaultExportDocument(input, blocks) {
    const inputs = input.briefAnswers ? briefAnswersToInputs(input.briefAnswers) : undefined;
    const title = input.sessionName?.trim()
        || input.projectName?.trim()
        || input.skillName
        || 'Untitled';
    return {
        title,
        subtitle: input.skillBlurb,
        skillId: input.skillId,
        skillName: input.skillName,
        projectId: input.projectId,
        createdAt: input.createdAt,
        modifiedAt: input.modifiedAt,
        inputs: inputs?.length ? inputs : undefined,
        blocks,
        metadata: {
            exportedBy: 'Renoir',
        },
    };
}
