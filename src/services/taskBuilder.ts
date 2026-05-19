import { CapabilityRegistryEntry } from '../types/capability';
import { UnifiedTask, TaskImagePayload } from '../types/task';

export function buildTask(
  capability: CapabilityRegistryEntry, 
  formData: Record<string, any>
): UnifiedTask {
   const prompt = formData.prompt || '';
   
   const images: TaskImagePayload[] = [];
   
   if (formData.first_frame) {
     images.push({ url: formData.first_frame, role: 'first_frame' });
   }
   if (formData.last_frame) {
     images.push({ url: formData.last_frame, role: 'last_frame' });
   }
   if (formData.reference_image) {
     images.push({ url: formData.reference_image, role: 'reference' });
   }
   if (formData.reference_images && Array.isArray(formData.reference_images)) {
     formData.reference_images.forEach((img: string, i: number) => {
       const role = formData.reference_roles && formData.reference_roles[i] 
         ? formData.reference_roles[i] 
         : 'reference';
       images.push({ url: img, role });
     });
   }
   
   const params = { ...formData };
   
   // 从 params 中移除一级属性，让 params 更纯粹只包括额外参数
   delete params.prompt;
   delete params.first_frame;
   delete params.last_frame;
   delete params.reference_image;
   delete params.reference_images;
   delete params.reference_roles;
   delete params._gen;

   return {
     task_id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
     capability: capability.id,
     api_type: capability.apiType,
     media_type: capability.mediaType,
     prompt,
     images,
     params,
     status: 'pending',
     created_at: Date.now()
   };
}
