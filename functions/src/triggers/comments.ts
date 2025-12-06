import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

const db = admin.firestore();

export const onCommentWritten = onDocumentWritten(
    {
        document: 'posts/{postId}/comments/{commentId}',
        region: 'us-central1',
    },
    async (event) => {
        const { postId } = event.params;
        const postRef = db.collection('posts').doc(postId);

        // If the document does not exist, it was deleted
        const isDelete = !event.data?.after.exists;
        // If the document did not exist before, it was created
        const isCreate = !event.data?.before.exists;

        if (isCreate) {
            await postRef.update({
                comments: admin.firestore.FieldValue.increment(1)
            });
        } else if (isDelete) {
            await postRef.update({
                comments: admin.firestore.FieldValue.increment(-1)
            });
        }
        // Updates (edits) don't change the count
    }
);
