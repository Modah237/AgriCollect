export type Locale = 'fr' | 'en'

export const dictionaries = {
  fr: {
    common: {
      appName: 'AgriCollect CM',
      dashboard: 'Tableau de bord',
      login: 'Connexion',
      logout: 'Déconnexion',
      loading: 'Chargement...',
      error: 'Une erreur est survenue',
      retry: 'Réessayer',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      actions: 'Actions',
      status: 'Statut',
      all: 'Tout',
      date: 'Date',
    },
    auth: {
      welcome: 'Bienvenue sur AgriCollect',
      subtitle: 'Gestion des collectes et paiements GIC',
      email: 'Email',
      password: 'Mot de passe',
      signIn: 'Se connecter',
      forgotPassword: 'Mot de passe oublié ?',
    },
    dashboard: {
      stats: {
        totalDeliveries: 'Total Livraisons',
        totalAmount: 'Montant Total',
        activeProducers: 'Producteurs Actifs',
        campaigns: 'Campagnes Actives',
        netDue: 'Net à payer',
        volumeTotal: 'Volume Total',
        deliveries: 'Livraisons',
        producers: 'Producteurs',
        payments: 'Paiements',
      },
      recentActivity: 'Activité Récente',
      noActivity: 'Aucune activité récente',
      payments: {
        title: 'Paiements Mobile Money',
        payAll: 'Initier le paiement groupé',
        launching: 'Traitement...',
        history: 'Historique des batches',
        noBatches: 'Aucun batch de paiement trouvé',
        detail: 'Détail du batch',
        confirmLaunch: 'Voulez-vous lancer le paiement pour {count} producteurs ?',
        stats: {
          confirmed: 'confirmés',
          failed: 'échoués',
          pending: 'en attente',
        }
      },
      sections: {
        overview: 'Aperçu',
        recentDeliveries: 'Livraisons Récentes',
        activeCampaign: 'Campagne Active',
        viewAll: 'Voir tout',
      },
      table: {
        producer: 'Producteur',
        product: 'Produit',
        quantity: 'Quantité',
        amount: 'Montant',
        date: 'Date',
      }
    },
  },
  en: {
    common: {
      appName: 'AgriCollect CM',
      dashboard: 'Dashboard',
      login: 'Login',
      logout: 'Logout',
      loading: 'Loading...',
      error: 'An error occurred',
      retry: 'Retry',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      actions: 'Actions',
      status: 'Status',
      all: 'All',
      date: 'Date',
    },
    auth: {
      welcome: 'Welcome to AgriCollect',
      subtitle: 'GIC collection and payment management',
      email: 'Email',
      password: 'Password',
      signIn: 'Sign In',
      forgotPassword: 'Forgot Password?',
    },
    dashboard: {
      stats: {
        totalDeliveries: 'Total Deliveries',
        totalAmount: 'Total Amount',
        activeProducers: 'Active Producers',
        campaigns: 'Active Campaigns',
        netDue: 'Net Due',
        volumeTotal: 'Total Volume',
        deliveries: 'Deliveries',
        producers: 'Producers',
        payments: 'Payments',
      },
      recentActivity: 'Recent Activity',
      noActivity: 'No recent activity',
      payments: {
        title: 'Mobile Money Payments',
        payAll: 'Initiate bulk payment',
        launching: 'Processing...',
        history: 'Batch history',
        noBatches: 'No payment batches found',
        detail: 'Batch detail',
        confirmLaunch: 'Launch payment for {count} producers?',
        stats: {
          confirmed: 'confirmed',
          failed: 'failed',
          pending: 'pending',
        }
      },
      sections: {
        overview: 'Overview',
        recentDeliveries: 'Recent Deliveries',
        activeCampaign: 'Active Campaign',
        viewAll: 'View all',
      },
      table: {
        producer: 'Producer',
        product: 'Product',
        quantity: 'Quantity',
        amount: 'Amount',
        date: 'Date',
      }
    },
  },
}

export const getDictionary = (locale: Locale) => dictionaries[locale] || dictionaries.fr
