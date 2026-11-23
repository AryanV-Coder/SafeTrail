from django import forms
from django.contrib.auth.models import User
from .models import EmergencyAlert


class AlertResolveForm(forms.ModelForm):
    class Meta:
        model = EmergencyAlert
        fields = ['resolution_notes', 'assigned_contact']
        widgets = {
            'resolution_notes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Enter resolution summary, responder actions, or outcome...',
            }),
            'assigned_contact': forms.Select(attrs={
                'class': 'form-control',
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['assigned_contact'].required = False
        self.fields['assigned_contact'].empty_label = "-- Unassigned --"

